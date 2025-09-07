import prompts from 'prompts';
import { getAllProcessGroups } from './get-process-groups.js';
import { NiFiBaseClient } from './nifi-base.js';

export async function selectProcessGroup(client: NiFiBaseClient): Promise<string> {
  console.log('🔍 Fetching available process groups...');
  
  try {
    // Get root process groups using the helper function
    const rootProcessGroups = await getAllProcessGroups(client, 'root');
    
    if (rootProcessGroups.length === 0) {
      console.log('⚠️  No process groups found. Using root group.');
      return 'root';
    }

    const choices = rootProcessGroups.map(pg => ({
      title: pg.component.name,
      value: pg.component.id,
      description: `ID: ${pg.component.id}`
    }));

    const response_prompt = await prompts({
      type: 'select',
      name: 'processGroupId',
      message: 'Select a process group to analyze:',
      choices: [
        { title: 'All Process Groups (root)', value: 'root', description: 'Analyze all process groups' },
        ...choices
      ],
      initial: 0,
    });

    if (!response_prompt.processGroupId){
      console.log('⚠️  No selection made. Bye Bye');
      process.exit(0);
    }
    
		return response_prompt.processGroupId || 'root';
  } catch (error) {
    console.error('❌ Error fetching process groups:', error);
    console.log('⚠️  Falling back to root group');
    return 'root';
  }

}