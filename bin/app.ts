#!/usr/bin/env node
import 'source-map-support/register.js';
import * as cdk from 'aws-cdk-lib';
import { getEnvironment } from './environments.js';
import { MainStage } from '../lib/main-stage.js';

const app = new cdk.App();

const stage = app.node.tryGetContext('stage');
if (!stage) {
  throw new Error('Stage context is required. Use: -c stage=dev|prod');
}

const environment = getEnvironment(stage);

new MainStage(app, environment.stage, {
  environment,
  env: {
    account: environment.account,
    region: environment.region,
  },
});

app.synth();
