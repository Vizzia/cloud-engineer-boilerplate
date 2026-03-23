import * as cdk from 'aws-cdk-lib';

export interface EnvironmentConfig {
  readonly account: string;
  readonly region: string;
  readonly stage: string;
  readonly prefix: string;
}

export const environments: Record<string, EnvironmentConfig> = {
  sandbox: {
    account: '983988120331',
    region: 'eu-west-1',
    stage: 'sandbox',
    prefix: 'cloud-eng-test',
  },
};

export function getEnvironment(stage: string): EnvironmentConfig {
  const env = environments[stage];
  if (!env) {
    throw new Error(
      `Unknown stage: ${stage}. Valid stages are: ${Object.keys(environments).join(', ')}`
    );
  }
  return env;
}

export function getCdkEnvironment(config: EnvironmentConfig): cdk.Environment {
  return {
    account: config.account,
    region: config.region,
  };
}
