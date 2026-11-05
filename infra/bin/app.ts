#!/usr/bin/env node
import { APIGatewayClient, paginateGetRestApis } from '@aws-sdk/client-api-gateway';
import * as cdk from 'aws-cdk-lib';
import { WebStack } from '../lib/web-stack';

const REGION = 'eu-west-3';

// The kamelott-lambda REST API is looked up by name (kaamelott-api-<env>) at synth time,
// so no API endpoint is committed. Needs AWS credentials, e.g. AWS_PROFILE=kaamelott.
async function findApiDomain(name: string): Promise<string> {
  const client = new APIGatewayClient({ region: REGION });
  for await (const page of paginateGetRestApis({ client }, {})) {
    const api = page.items?.find(item => item.name === name);
    if (api?.id) return `${api.id}.execute-api.${REGION}.amazonaws.com`;
  }
  throw new Error(`REST API "${name}" not found in ${REGION}`);
}

async function main() {
  const app = new cdk.App();

  const env: string = app.node.tryGetContext('env') ?? 'staging';
  if (env !== 'staging' && env !== 'prod') {
    throw new Error(`Unknown env "${env}". Use --context env=staging or --context env=prod`);
  }

  new WebStack(app, `kaamelott-app-${env}`, {
    env: {
      region: REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
    environment: env,
    apiDomain: await findApiDomain(`kaamelott-api-${env}`),
    apiStage: env, // kamelott-lambda deploys each env to a stage of the same name
    // Created by kamelott-lambda (WebApiKeySecret); CloudFront sends it as x-api-key.
    apiKeySecretName: `kaamelott-web-api-key-${env}`,
  });
}

main().catch(err => {
  console.error(err);
  // cdk --profile isn't passed on to this process: the SDK lookup needs AWS_PROFILE.
  if (err?.name === 'CredentialsProviderError') {
    console.error('\nNo AWS credentials for the API lookup. Run with AWS_PROFILE=kaamelott (not --profile).');
  }
  process.exit(1);
});
