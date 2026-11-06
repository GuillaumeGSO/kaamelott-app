import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';

export interface WebStackProps extends cdk.StackProps {
  environment: 'staging' | 'prod';
  /** API Gateway host of the kaamelott-lambda REST API, e.g. abc123.execute-api.eu-west-3.amazonaws.com */
  apiDomain: string;
  /** API Gateway stage name, used as the origin path */
  apiStage: string;
  /** Secrets Manager secret holding the x-api-key value */
  apiKeySecretName: string;
}

const DIST_DIR = path.join(__dirname, '..', '..', 'dist');

// Paths served by the API rather than the static site. Keep in sync with src/api/client.ts.
const API_PATH_PATTERNS = ['/quotes/*', '/favorites', '/favorites/*'];

// API responses shared by every visitor, cached at the edge: this is what keeps API Gateway
// (billed per call) and the usage plan quota out of the way of ordinary visits. Listed before
// the API patterns above, since CloudFront picks the first behavior that matches.
const CACHED_API_PATHS = {
  // Quotes change only when kaamelott-lambda reloads them.
  '/quotes/all': cdk.Duration.days(1),
  // Like counts: a few minutes behind is fine (a visitor's own likes update locally).
  '/quotes/likes': cdk.Duration.minutes(5),
};

export class WebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const { environment, apiDomain, apiStage, apiKeySecretName } = props;
    const isProd = environment === 'prod';

    const bucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `kaamelott-app-${environment}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // Client-side routes (no file extension) are served by index.html. Done in a function rather
    // than with distribution-wide error responses, which would also rewrite the API's 404s
    // ("no favorites found") into the HTML page.
    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  if (!request.uri.includes('.')) request.uri = '/index.html';
  return request;
}`),
    });

    // The API key is resolved by CloudFormation from Secrets Manager and only ever sent from
    // CloudFront to API Gateway: browsers never see it.
    const apiOrigin = new origins.HttpOrigin(apiDomain, {
      originPath: `/${apiStage}`,
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      customHeaders: {
        'x-api-key': cdk.SecretValue.secretsManager(apiKeySecretName).unsafeUnwrap(),
      },
    });

    const apiBehavior: cloudfront.BehaviorOptions = {
      origin: apiOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    };

    const cachedApiBehaviors = Object.entries(CACHED_API_PATHS).map(([pattern, ttl]) => {
      const name = pattern.slice(1).replace(/\W+/g, '-'); // '/quotes/all' → 'quotes-all'
      const cachePolicy = new cloudfront.CachePolicy(this, `CachePolicy-${name}`, {
        cachePolicyName: `kaamelott-app-${name}-${environment}`,
        // Fixed TTL whatever the API's own Cache-Control says (that one is for browsers).
        defaultTtl: ttl,
        minTtl: ttl,
        maxTtl: ttl,
        // Cache key: the path only. Gzip/Brotli let CloudFront compress (quotes: 380 KB → ~100 KB).
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      });
      return [pattern, { ...apiBehavior, allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD, cachePolicy }] as const;
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `kaamelott-app ${environment}`,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [{ function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: Object.fromEntries([
        ...cachedApiBehaviors,
        ...API_PATH_PATTERNS.map(pattern => [pattern, apiBehavior] as const),
      ]),
    });

    // Hashed build assets never change: cache them for a year. Everything else (index.html,
    // favicon, manifest) must be revalidated so a deploy is picked up right away.
    new s3deploy.BucketDeployment(this, 'DeployAssets', {
      sources: [s3deploy.Source.asset(path.join(DIST_DIR, 'assets'))],
      destinationBucket: bucket,
      destinationKeyPrefix: 'assets/',
      cacheControl: [s3deploy.CacheControl.fromString('public, max-age=31536000, immutable')],
      prune: false,
    });
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [s3deploy.Source.asset(DIST_DIR, { exclude: ['assets/**'] })],
      destinationBucket: bucket,
      cacheControl: [s3deploy.CacheControl.fromString('no-cache')],
      prune: false,
      distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}
