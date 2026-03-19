import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../bin/environments.js';

export interface StageBaseProps extends cdk.StageProps {
  readonly environment: EnvironmentConfig;
}

export class StageBase extends cdk.Stage {
  public readonly environment: EnvironmentConfig;

  constructor(scope: Construct, id: string, props: StageBaseProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.environment.account,
        region: props.environment.region,
      },
    });

    this.environment = props.environment;

    cdk.Tags.of(this).add('team', 'ai');
    cdk.Tags.of(this).add('environment', props.environment.stage);
  }

  protected prefixedId(id: string): string {
    return `${this.environment.prefix}-${id}`;
  }
}
