import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../bin/environments';

export interface StageBaseProps {
  readonly environment: EnvironmentConfig;
}

export class StageBase extends Construct {
  public readonly environment: EnvironmentConfig;

  constructor(scope: Construct, id: string, props: StageBaseProps) {
    super(scope, id);

    this.environment = props.environment;

    cdk.Tags.of(this).add('team', 'ai');
    cdk.Tags.of(this).add('environment', props.environment.stage);
  }

  protected prefixedId(id: string): string {
    return this.environment.prefix
      ? `${this.environment.prefix}-${id}`
      : id;
  }
}
