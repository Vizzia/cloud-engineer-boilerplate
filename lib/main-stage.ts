import { Construct } from 'constructs';
import { StageBase, StageBaseProps } from './stage-base.js';
import { StorageStack } from './storage-stack/storage-stack.js';
import { ProcessingStack } from './processing-stack/processing-stack.js';

export class MainStage extends StageBase {
  constructor(scope: Construct, id: string, props: StageBaseProps) {
    super(scope, id, props);

    const storage = new StorageStack(this, this.prefixedId('StorageStack'), {
      environment: this.environment,
    });

    new ProcessingStack(this, this.prefixedId('ProcessingStack'), {
      environment: this.environment,
      dataBucket: storage.dataBucket,
      resultsBucket: storage.resultsBucket,
    });
  }
}
