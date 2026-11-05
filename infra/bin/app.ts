#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WebStack } from '../lib/web-stack';

// API Gateway endpoints of the kamelott-lambda stacks, per environment.
const API = {
  staging: { domain: '<api-id>.execute-api.eu-west-3.amazonaws.com', stage: 'staging' },
  prod: { domain: '<api-id>.execute-api.eu-west-3.amazonaws.com', stage: 'prod' },
} as const;

const app = new cdk.App();

const env: string = app.node.tryGetContext('env') ?? 'staging';
if (env !== 'staging' && env !== 'prod') {
  throw new Error(`Unknown env "${env}". Use --context env=staging or --context env=prod`);
}

new WebStack(app, `kaamelott-app-${env}`, {
  env: {
    region: 'eu-west-3',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  environment: env,
  apiDomain: API[env].domain,
  apiStage: API[env].stage,
  // Created by kamelott-lambda (WebApiKeySecret); CloudFront sends it as x-api-key.
  apiKeySecretName: `kaamelott-web-api-key-${env}`,
});
