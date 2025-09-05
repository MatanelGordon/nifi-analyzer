import { NiFiBaseClient } from './nifi-base';

// Types based on NiFi REST API /flow/processors/{id}/status/history response
export interface FieldDescriptor {
	field: string;
	label: string;
	description: string;
	formatter?: string | null;
}

export interface ComponentDetails {
 	Type: string;
 	Id: string;
 	"Group Id": string;
 	Name: string;
 	// allow additional unknown properties NiFi may include
 	[key: string]: any;
}

export interface StatusMetrics {
 	averageLineageDuration: number;
 	bytesWritten: number;
 	outputCount: number;
 	bytesTransferred: number;
 	flowFilesRemoved: number;
 	bytesRead: number;
 	taskNanos: number;
 	averageTaskNanos: number;
 	outputBytes: number;
 	taskCount: number;
 	inputBytes: number;
 	taskMillis: number;
 	inputCount: number;
 	// allow for future/other metrics
 	[key: string]: number | any;
}

export interface AggregateSnapshot {
 	timestamp: number;
 	statusMetrics: StatusMetrics;
}

export interface StatusHistory {
	generated: string;
	componentDetails: ComponentDetails;
	fieldDescriptors: FieldDescriptor[];
	aggregateSnapshots: AggregateSnapshot[];
	nodeSnapshots: {
		nodeId: string;
		address: string;
		apiPort: number;
		statusSnapshots: {
            timestamp: number;
            statusMetrics: StatusMetrics;
        }[];
	}[];
}

export interface NiFiProcessorStatusHistoryResponse {
 	statusHistory: StatusHistory;
 	canRead: boolean;
 	// NiFi may include other top-level fields; allow them
 	[key: string]: any;
}

/**
 * Fetch the full status history for a given NiFi processor ID.
 * Uses the NiFi REST API route: /nifi-api/flow/processors/{id}/status/history
 */
export async function getStatusHistory(
	client: NiFiBaseClient,
	processorId: string
): Promise<StatusHistory> {
	if (!processorId) {
		throw new Error('processorId is required');
	}

	const data = await client.get<NiFiProcessorStatusHistoryResponse>(
		`/nifi-api/flow/processors/${processorId}/status/history`
	);

    // In case youre not analyzing a clustered NiFi instance
    if(data.statusHistory.nodeSnapshots === undefined) {
        data.statusHistory.nodeSnapshots = [];
    }

	return data.statusHistory;
}



