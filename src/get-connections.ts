import { NiFiBaseClient } from './nifi-base';

// --- Minimal DTOs we read from the NiFi REST payloads ---

export type ConnectableType =
	| 'PROCESSOR'
	| 'REMOTE_INPUT_PORT'
	| 'REMOTE_OUTPUT_PORT'
	| 'INPUT_PORT'
	| 'OUTPUT_PORT'
	| 'FUNNEL';

export interface ConnectableDTO {
	id: string;
	type: ConnectableType;
	groupId: string;
	name: string;
}

export type LoadBalanceStrategy =
	| 'DO_NOT_LOAD_BALANCE'
	| 'PARTITION_BY_ATTRIBUTE'
	| 'ROUND_ROBIN'
	| 'SINGLE_NODE';

export type LoadBalanceCompression =
	| 'DO_NOT_COMPRESS'
	| 'COMPRESS_ATTRIBUTES_ONLY'
	| 'COMPRESS_ATTRIBUTES_AND_CONTENT';

export type LoadBalanceStatus =
	| 'LOAD_BALANCE_NOT_CONFIGURED'
	| 'LOAD_BALANCE_INACTIVE'
	| 'LOAD_BALANCE_ACTIVE';

export interface ConnectionDTO {
	id: string;
	parentGroupId?: string;
	name: string;
	source: ConnectableDTO;
	destination: ConnectableDTO;
	selectedRelationships?: string[];
	prioritizers?: string[];
	backPressureObjectThreshold?: number;
	backPressureDataSizeThreshold?: string;
	flowFileExpiration?: string;
	loadBalanceStrategy?: LoadBalanceStrategy | null;
	loadBalancePartitionAttribute?: string | null;
	loadBalanceCompression?: LoadBalanceCompression | null;
	loadBalanceStatus?: LoadBalanceStatus | null;
}

export interface ConnectionEntity {
	id?: string;
	component?: ConnectionDTO;
}

export interface FlowDTO {
	connections?: ConnectionEntity[];
}

// --- What we return to your app ---

export interface ConnectionInfo {
	id: string;
	name?: string;
	selectedRelationships: string[];
	prioritizers: string[];
	source: { id: string; type: ConnectableType; name: string };
	destination: { id: string; type: ConnectableType; name: string };
	loadBalanced: boolean; // derived
	loadBalanceStrategy?: LoadBalanceStrategy | null;
	loadBalancePartitionAttribute?: string | null;
	loadBalanceCompression?: LoadBalanceCompression | null;
	loadBalanceStatus?: LoadBalanceStatus | null;
	backPressureObjectThreshold?: number;
	backPressureDataSizeThreshold?: string;
	flowFileExpiration?: string;
}

/**
 * Returns all connections for the given process group with key settings:
 * - which component is at each end (id/type/name)
 * - whether it's load-balanced and how
 * - queue prioritizers and basic queue settings
 */
export async function listConnectionsForGroup(
	client: NiFiBaseClient,
	processGroupId: string
): Promise<ConnectionInfo[]> {
	// Pull the group's flow, then read flow.connections
	const data = await client.get<FlowDTO>(
		`/nifi-api/process-groups/${processGroupId}/connections`
	); // flow.connections is documented on FlowDTO. :contentReference[oaicite:6]{index=6}

	const conns: ConnectionEntity[] = data?.connections ?? [];

	return conns
		.map(ce => ce.component)
		.filter((c): c is ConnectionDTO =>
			Boolean(c && c.id && c.source && c.destination)
		)
		.map(c => {
			const loadBalanced =
				!!c.loadBalanceStrategy &&
				c.loadBalanceStrategy !== 'DO_NOT_LOAD_BALANCE';

			return {
                ...c,
				selectedRelationships: c.selectedRelationships ?? [],
				prioritizers: c.prioritizers ?? [],
				source: {
					id: c.source!.id,
					type: c.source!.type as ConnectableType,
					name: c.source!.name ?? 'UNKNOWN',
				},
				destination: {
					id: c.destination!.id,
					type: c.destination!.type as ConnectableType,
					name: c.destination!.name ?? 'UNKNOWN',
				},
				loadBalanced,
				loadBalanceStrategy: c.loadBalanceStrategy ?? null,
				loadBalancePartitionAttribute:
					c.loadBalancePartitionAttribute ?? null,
				loadBalanceCompression: c.loadBalanceCompression ?? null,
				loadBalanceStatus: c.loadBalanceStatus ?? null,
			} satisfies ConnectionInfo;
		});


}