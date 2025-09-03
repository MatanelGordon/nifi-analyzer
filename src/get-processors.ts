import { NiFiBaseClient } from './nifi-base.js';

export interface ProcessorInfo {
  name: string;
  id: string;
  type: string;
  run_duration: number;
  concurrent_tasks: number;
  scheduling_strategy: string;
  run_schedule: string;
  execution: string;
  comments: string;
}

export interface Processor {
	component: {
		id: string;
		name: string;
		type: string;
		config: {
			schedulingStrategy: string;
			schedulingPeriod: string;
			runDurationMillis: number;
			concurrentlySchedulableTaskCount: number;
			executionNode: string;
			comments?: string;
			autoTerminatedRelationships?: string[];
		};
	};
	status: {
		runStatus: string;
	};
}

export interface ProcessorsResponse {
  processors: Processor[];
}

export async function getProcessorsInGroup(
  client: NiFiBaseClient,
  processGroupId: string
): Promise<ProcessorInfo[]> {
  try {
    console.log(`🔧 Fetching processors for PG ID: ${processGroupId}`);
    
    const response = await client.get<ProcessorsResponse>(
      `/nifi-api/process-groups/${processGroupId}/processors`
    );

    const processors = response.processors || [];
    console.log(`⚙️  Found ${processors.length} processors in ${processGroupId}`);

    const processorInfos: ProcessorInfo[] = processors.map(processor => {
      // Extract processor type (last part after the last dot)
      const processorType = processor.component.type.split('.').pop() || processor.component.type;
      
      // Extract run duration in milliseconds
      const runDuration = processor.component.config.runDurationMillis || 0;
      
      // Extract concurrent tasks
      const concurrentTasks = processor.component.config.concurrentlySchedulableTaskCount || 1;
      
      // Extract scheduling strategy
      const schedulingStrategy = processor.component.config.schedulingStrategy || 'TIMER_DRIVEN';
      
      // Extract run schedule
      const runSchedule = processor.component.config.schedulingPeriod || '0 sec';
      
      // Extract execution node
      const execution = processor.component.config.executionNode === 'ALL' ? 'ALL_NODES' : 'PRIMARY_NODE';
      
      // Extract comments
      const comments = processor.component.config.comments || '';

      return {
        name: processor.component.name,
        id: processor.component.id,
        type: processorType,
        run_duration: runDuration,
        concurrent_tasks: concurrentTasks,
        scheduling_strategy: schedulingStrategy,
        run_schedule: runSchedule,
        execution: execution,
        comments: comments
      };
    });

    return processorInfos;
  } catch (error) {
    console.error(`❌ Error fetching processors for ${processGroupId}:`, error);
    throw error;
  }
}



