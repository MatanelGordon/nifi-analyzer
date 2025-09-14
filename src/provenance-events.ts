import { NiFiBaseClient } from './nifi-base';

// --- Entities ---
export interface ProvenanceEntity {
	provenance?: ProvenanceDTO;
}

export interface ProvenanceEventEntity {
	provenanceEvent?: ProvenanceEventDTO;
}

export interface ProvenanceOptionsEntity {
	provenanceOptions?: ProvenanceOptionsDTO;
}

// --- DTOs ---
export interface ProvenanceDTO {
	id?: string;
	uri?: string;
	submissionTime?: string;
	expiration?: string;
	percentCompleted?: number;
	finished?: boolean;
	request?: ProvenanceRequestDTO;
	results?: ProvenanceResultsDTO;
}

export interface ProvenanceRequestDTO {
	/** Map field -> search value; e.g. { ProcessorID: { value: "<uuid>" } } */
	searchTerms?: Partial<
		Record<
			| 'EventType'
			| 'FlowFileUUID'
			| 'Filename'
			| 'ProcessorID'
			| 'Relationship',
			ProvenanceSearchValueDTO
		>
	>;
	startDate?: string;
	endDate?: string;
	minimumFileSize?: string;
	maximumFileSize?: string;
	maxResults: number;
	/** default false per docs */
	summarize?: boolean;
	/** default true per docs */
	incrementalResults?: boolean;
}

export interface ProvenanceSearchValueDTO {
	value?: string;
	inverse?: boolean;
}

export interface ProvenanceResultsDTO {
	provenanceEvents?: ProvenanceEventDTO[];
	total?: string;
	totalCount?: number;
	generated?: string;
	oldestEvent?: string;
	timeOffset?: number;
	errors?: string[];
}

export interface ProvenanceEventDTO {
	id: string;
	eventId: number;
	eventTime?: string;
	eventDuration?: number;
	lineageDuration?: number;
	eventType?: string;
	flowFileUuid?: string;
	fileSize?: string;
	fileSizeBytes?: number;
	clusterNodeId?: string;
	clusterNodeAddress?: string;
	groupId?: string;
	componentId?: string;
	componentType?: string;
	componentName?: string;
	sourceSystemFlowFileId?: string;
	alternateIdentifierUri?: string;
	attributes?: AttributeDTO[];
	parentUuids?: string[];
	childUuids?: string[];
	transitUri?: string;
	relationship?: string;
	details?: string;
	contentEqual?: boolean;
	inputContentAvailable?: boolean;
	inputContentClaimSection?: string;
	inputContentClaimContainer?: string;
	inputContentClaimIdentifier?: string;
	inputContentClaimOffset?: number;
	inputContentClaimFileSize?: string;
	inputContentClaimFileSizeBytes?: number;
	outputContentAvailable?: boolean;
	outputContentClaimSection?: string;
	outputContentClaimContainer?: string;
	outputContentClaimIdentifier?: string;
	outputContentClaimOffset?: number;
	outputContentClaimFileSize?: string;
	outputContentClaimFileSizeBytes?: number;
	replayAvailable?: boolean;
	replayExplanation?: string;
	sourceConnectionIdentifier?: string;
}

export interface AttributeDTO {
	name?: string;
	value?: string;
}

export interface ProvenanceOptionsDTO {
	searchableFields?: ProvenanceSearchableFieldDTO[];
}

export interface ProvenanceSearchableFieldDTO {
	id?: string;
	field?: string;
	label?: string;
	type?: string;
}

export interface QueryByProcessorOpts {
	/** Inclusive time window strings accepted by NiFi (e.g., "09/01/2025 00:00:00 UTC") */
	startDate?: string;
	endDate?: string;

	/** ProvenanceRequestDTO options */
	maxResults?: number;
	/** Defaults: summarize=false, incrementalResults=true (per docs) */
	summarize?: boolean;
	incrementalResults?: boolean;
}

/** POST /provenance  — body: { provenance: { request: ... } } */
export async function submitProvenanceQuery(
	client: NiFiBaseClient,
	request: ProvenanceRequestDTO
): Promise<ProvenanceEntity> {
	const body: ProvenanceEntity = { provenance: { request } };
	return await client.post<ProvenanceEntity>('/nifi-api/provenance', body);
}

/** GET /provenance/{id}  (polling) */
export async function getProvenanceQuery(
	client: NiFiBaseClient,
	id: string,
	params?: {
		summarize?: boolean;
		incrementalResults?: boolean;
	}
): Promise<ProvenanceEntity> {
	const sp = new URLSearchParams(
		Object.entries(params ?? {}).map(([k, v]) => [k, String(v)])
	);

	return client.get<ProvenanceEntity>(`/nifi-api/provenance/${id}?${sp}`);
}

/** DELETE /provenance/{id}  (cleanup) */
export async function deleteProvenanceQuery(
	client: NiFiBaseClient,
	id: string,
	params?: {}
): Promise<ProvenanceEntity> {
	const sp = new URLSearchParams(
		Object.entries(params ?? {}).map(([k, v]) => [k, String(v)])
	);

	return client.delete<ProvenanceEntity>(`/nifi-api/provenance/${id}?${sp}`);
}

export async function* streamAllProvenanceEventsForProcessor(
	client: NiFiBaseClient,
	processorId: string
): AsyncGenerator<ProvenanceEventDTO[], void, void> {
	try {
		const request: ProvenanceRequestDTO = {
			searchTerms: { ProcessorID: { value: processorId } },
			summarize: false,
			maxResults: 1000,
			incrementalResults: true,
		};

		const submitted = await submitProvenanceQuery(client, request);
		const qid = submitted.provenance?.id;
		if (!qid) throw new Error('NiFi did not return a provenance query id');

		const seen = new Set<string>();

		try {
			// Busy-poll (no delays), yield only NEW events in bulk
			while (true) {
				const res = await getProvenanceQuery(client, qid, {
					summarize: false,
					incrementalResults: true,
				});
				const events = res.provenance?.results?.provenanceEvents ?? [];

				const batch: ProvenanceEventDTO[] = [];
				for (const e of events) {
					const id = e.id ?? '';
					if (!id || seen.has(id)) continue;
					seen.add(id);
					batch.push(e);
				}

				if (batch.length) {
					yield batch;
				}

				if (res.provenance?.finished) break;
			}
		} finally {
			try {
				await deleteProvenanceQuery(client, qid);
			} catch {
				console.error('Error Deleting Provenance Query');
			}
		}
	} catch (e) {
		console.error(e);
	}
}



