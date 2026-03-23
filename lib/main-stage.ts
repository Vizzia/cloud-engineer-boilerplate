import { Construct } from 'constructs';
import { StageBase, StageBaseProps } from './stage-base';
import { StorageStack } from './storage-stack/storage-stack';
import { ProcessingStack } from './processing-stack/processing-stack';

export class MainStage extends StageBase {
  constructor(scope: Construct, id: string, props: StageBaseProps) {
    super(scope, id, props);

    const env = {
      account: this.environment.account,
      region: this.environment.region,
    };

    const storage = new StorageStack(this, this.prefixedId('StorageStack'), {
      env,
      environment: this.environment,
    });

    new ProcessingStack(this, this.prefixedId('ProcessingStack'), {
      env,
      environment: this.environment,
      dataBucket: storage.dataBucket,
      resultsBucket: storage.resultsBucket,
    });
  }
}
