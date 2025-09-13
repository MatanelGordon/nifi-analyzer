import { NiFiBaseClient } from './nifi-base.js';

export interface ProcessGroup {
	component: {
		name: string;
		id: string;
		parentGroupId?: string;
		comments?: string;
	};
}

export interface ProcessGroupsResponse {
	processGroups: ProcessGroup[];
}

export async function* getProcessGroups(
	client: NiFiBaseClient,
	processGroupId: string = 'root',
	includeSelf = true
): AsyncGenerator<ProcessGroup, void, unknown> {
	try {
		console.log(`🔍 Fetching process groups for PG ID: ${processGroupId}`);

		if (includeSelf) {
			const self = await client.get<ProcessGroup>(
				`/nifi-api/process-groups/${processGroupId}`
			);

			yield self;
		}

		const response = await client.get<ProcessGroupsResponse>(
			`/nifi-api/process-groups/${processGroupId}/process-groups`
		);

		const processGroups = response.processGroups || [];

		// Yield each process group
		for (const processGroup of processGroups) {
			console.log(
				`  📂 Processing group: ${processGroup.component.name} (${processGroup.component.id})`
			);
			yield processGroup;

			// Recursively get nested process groups
			yield* getProcessGroups(client, processGroup.component.id, false);
		}
	} catch (error) {
		console.error(
			`❌ Error fetching process groups for ${processGroupId}:`,
			error
		);
		throw error;
	}
}

export async function getAllProcessGroups(
	client: NiFiBaseClient,
	processGroupId: string = 'root'
): Promise<ProcessGroup[]> {
	const allProcessGroups: ProcessGroup[] = [];

	for await (const processGroup of getProcessGroups(client, processGroupId)) {
		allProcessGroups.push(processGroup);
	}

	return allProcessGroups;
}

