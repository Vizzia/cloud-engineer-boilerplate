import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../bin/environments';

export interface StorageStackProps extends cdk.StackProps {
  readonly environment: EnvironmentConfig;
}

export class StorageStack extends cdk.Stack {
  public readonly dataBucket: s3.Bucket;
  public readonly resultsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    this.dataBucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: `ai-data-${props.environment.stage}-${props.environment.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy:
        props.environment.stage === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment.stage !== 'prod',
      eventBridgeEnabled: true,
    });

    this.resultsBucket = new s3.Bucket(this, 'ResultsBucket', {
      bucketName: `ai-results-${props.environment.stage}-${props.environment.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:
        props.environment.stage === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment.stage !== 'prod',
    });
  }
}
