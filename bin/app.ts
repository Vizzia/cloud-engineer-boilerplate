#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { getEnvironment } from './environments';
import { MainStage } from '../lib/main-stage';

const app = new cdk.App();

const environment = getEnvironment("sandbox");

new MainStage(app, environment.stage, {
  environment,
});

app.synth();
