import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../../../bin/environments.js';

export interface ProcessDataFunctionProps {
  readonly dataBucket: s3.Bucket;
  readonly resultsBucket: s3.Bucket;
  readonly environment: EnvironmentConfig;
}

export class ProcessDataFunction extends Construct {
  public readonly function: PythonFunction;

  constructor(scope: Construct, id: string, props: ProcessDataFunctionProps) {
    super(scope, id);

    this.function = new PythonFunction(this, 'Function', {
      functionName: `ai-process-data-${props.environment.stage}`,
      description: 'Process incoming data files and store results',
      entry: path.join(__dirname, 'code'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_handler',
      index: 'src/app.py',
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: {
        DATA_BUCKET: props.dataBucket.bucketName,
        RESULTS_BUCKET: props.resultsBucket.bucketName,
        STAGE: props.environment.stage,
      },
    });

    // Grant the Lambda read access to the data bucket and write access to results
    props.dataBucket.grantRead(this.function);
    props.resultsBucket.grantWrite(this.function);
  }
}
