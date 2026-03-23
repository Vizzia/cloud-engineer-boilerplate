import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../bin/environments';
import { ProcessDataFunction } from './functions/process-data/process-data-function';

export interface ProcessingStackProps extends cdk.StackProps {
  readonly environment: EnvironmentConfig;
  readonly dataBucket: s3.Bucket;
  readonly resultsBucket: s3.Bucket;
}

export class ProcessingStack extends cdk.Stack {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: ProcessingStackProps) {
    super(scope, id, props);

    // Lambda function for data processing
    const processDataFunction = new ProcessDataFunction(this, 'ProcessDataFunction', {
      dataBucket: props.dataBucket,
      resultsBucket: props.resultsBucket,
      environment: props.environment,
    });

    // Step Function definition
    const processDataStep = new tasks.LambdaInvoke(this, 'ProcessData', {
      lambdaFunction: processDataFunction.function,
      outputPath: '$.Payload',
    });

    const checkStatusStep = new sfn.Choice(this, 'CheckStatus')
      .when(sfn.Condition.stringEquals('$.status', 'FAILED'), new sfn.Fail(this, 'ProcessingFailed', {
        cause: 'Data processing failed',
        error: 'PROCESSING_ERROR',
      }))
      .otherwise(new sfn.Succeed(this, 'ProcessingComplete'));

    const definition = processDataStep.next(checkStatusStep);

    this.stateMachine = new sfn.StateMachine(this, 'ProcessingStateMachine', {
      stateMachineName: `ai-processing-${props.environment.stage}`,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(30),
      tracingEnabled: true,
    });
  }
}
