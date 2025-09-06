import _ from 'lodash';
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
	properties: Record<string, string | null>;
}

export interface ProcessorEntity {
	revision?: RevisionDTO;
	id?: string;
	uri?: string;
	position?: PositionDTO;
	permissions?: PermissionsDTO;
	bulletins?: BulletinEntity[];
	disconnectedNodeAcknowledged?: boolean;
	component: ProcessorDTO;
	inputRequirement?: string; // per docs it's a string enum
	status?: ProcessorStatusDTO;
	operatePermissions?: PermissionsDTO;
}

export interface ProcessorDTO {
	id: string;
	versionedComponentId: string;
	parentGroupId: string;
	position: PositionDTO;
	name: string;
	type: string;
	bundle: BundleDTO;
	state: 'RUNNING' | 'STOPPED' | 'DISABLED';
	style: Record<string, string>;
	relationships: RelationshipDTO[];
	description: string;
	supportsParallelProcessing: boolean;
	supportsEventDriven: boolean;
	supportsBatching: boolean;
	supportsSensitiveDynamicProperties: boolean;
	persistsState: boolean;
	restricted: boolean;
	deprecated: boolean;
	executionNodeRestricted: boolean;
	multipleVersionsAvailable: boolean;
	inputRequirement: string;
	config: ProcessorConfigDTO; // includes properties + descriptors
	validationErrors: string[];
	validationStatus: 'VALID' | 'INVALID' | 'VALIDATING';
	extensionMissing: boolean;
}

export interface ProcessorConfigDTO {
	// Current values; if a property is defined but unset, it may have an empty value.
	// (Docs: "Properties whose value is not set will only contain the property name.")
	properties?: Record<string, string | null>;

	// Map of property name -> descriptor. The REST docs model this as PropertyDescriptorDTO.
	// Some endpoints (e.g. /processors/{id}/descriptors) wrap it as { propertyDescriptor: ... }.
	// The union below keeps your code resilient.
	descriptors?: Record<
		string,
		PropertyDescriptorDTO | PropertyDescriptorEntityLike
	>;

	sensitiveDynamicPropertyNames?: string[];

	// Scheduling & misc. fields (subset that appears in responses)
	schedulingPeriod?: string;
	schedulingStrategy?: string;
	executionNode?: string;
	penaltyDuration?: string;
	yieldDuration?: string;
	bulletinLevel?: string;
	runDurationMillis?: number;
	concurrentlySchedulableTaskCount?: number;
	autoTerminatedRelationships?: string[];
	comments?: string;
	customUiUrl?: string;
	lossTolerant?: boolean;
	annotationData?: string;
	defaultConcurrentTasks?: Record<string, number>;
	defaultSchedulingPeriod?: Record<string, string>;
	retryCount?: number;
	retriedRelationships?: string[];
	backoffMechanism?: 'PENALIZE_FLOWFILE' | 'YIELD_PROCESSOR' | string;
	maxBackoffPeriod?: string;
}

export interface PropertyDescriptorDTO {
	name?: string;
	displayName?: string;
	description?: string;
	defaultValue?: string;
	allowableValues?: AllowableValueEntity[]; // optional
	required?: boolean;
	sensitive?: boolean;
	dynamic?: boolean;
	supportsEl?: boolean;
	// (Additional descriptor fields exist in the docs; include as needed)
}

// Wrapper form seen on the /processors/{id}/descriptors endpoint.
export interface PropertyDescriptorEntityLike {
	propertyDescriptor?: PropertyDescriptorDTO;
}

export type DescriptorEntry =
	| PropertyDescriptorDTO
	| PropertyDescriptorEntityLike;

// --- Light supporting DTOs (trimmed to what's commonly needed) ---

export interface RevisionDTO {
	clientId?: string;
	version?: number;
	lastModifier?: string;
}

export interface PositionDTO {
	x?: number;
	y?: number;
}

export interface PermissionsDTO {
	canRead?: boolean;
	canWrite?: boolean;
}

export interface BulletinEntity {
	id?: number;
	level?: string;
	message?: string;
	timestamp?: string;
	category?: string;
	nodeAddress?: string;
}

export interface ProcessorStatusDTO {
	[k: string]: unknown;
}

export interface BundleDTO {
	group?: string;
	artifact?: string;
	version?: string;
}

export interface RelationshipDTO {
	name?: string;
	description?: string;
	autoTerminate?: boolean;
}

export interface AllowableValueEntity {
	allowableValue?: {
		displayName?: string;
		value?: string;
		description?: string;
	};
}

export interface ProcessorsResponse {
	processors: ProcessorEntity[];
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
		console.log(
			`⚙️  Found ${processors.length} processors in ${processGroupId}`
		);

		const processorInfos: ProcessorInfo[] = processors.map(processor => {
			// Extract processor type (last part after the last dot)
			const processorType =
				processor.component.type.split('.').pop() ||
				processor.component.type;

			// Extract run duration in milliseconds
			const runDuration =
				processor.component.config.runDurationMillis || 0;

			// Extract concurrent tasks
			const concurrentTasks =
				processor.component.config.concurrentlySchedulableTaskCount ||
				1;

			// Extract scheduling strategy
			const schedulingStrategy =
				processor.component.config.schedulingStrategy || 'TIMER_DRIVEN';

			// Extract run schedule
			const runSchedule =
				processor.component.config.schedulingPeriod || '0 sec';

			// Extract execution node
			const execution =
				processor.component.config.executionNode === 'ALL'
					? 'ALL_NODES'
					: 'PRIMARY_NODE';

			// Extract comments
			const comments = processor.component.config.comments || '';

			const properties = extractProcessorProperties(processor);

			return {
				name: processor.component.name,
				id: processor.component.id,
				type: processorType,
				run_duration: runDuration,
				concurrent_tasks: concurrentTasks,
				scheduling_strategy: schedulingStrategy,
				run_schedule: runSchedule,
				execution: execution,
				comments: comments,
				properties,
			};
		});

		return processorInfos;
	} catch (error) {
		console.error(
			`❌ Error fetching processors for ${processGroupId}:`,
			error
		);
		throw error;
	}
}

export function extractProcessorProperties(
	entity: ProcessorEntity
): Record<string, string | null> {
	const cfg = entity?.component?.config;
	if (!cfg) return {};

	const properties = cfg.properties ?? {};
	const descriptors = cfg.descriptors ?? {};
	const sensitiveDynamic = new Set(cfg.sensitiveDynamicPropertyNames ?? []);

	const extractDesc = createDescriptorExtractor(cfg);

	// union of keys from descriptors & current properties
	const keys = Array.from(
		new Set([...Object.keys(descriptors), ...Object.keys(properties)])
	);

	return _(keys)
		.map(key => {
			const desc = extractDesc(key);

			const isSensitive =
				Boolean(desc?.sensitive) || sensitiveDynamic.has(key);

			if (isSensitive) return [key, 'SENSITIVE VALUE'] as const;

			const current = properties[key];
			const isEmpty = _.isNil(current) || current.trim().length === 0;

			const value = isEmpty ? desc?.defaultValue ?? null : current;
			return [key, value as string | null] as const;
		})
		.fromPairs()
		.value();
}

/**
 * Creates a descriptor extractor function for a specific processor configuration.
 * The returned function can be used to extract property descriptors by key.
 *
 * @param config The processor configuration containing descriptors
 * @returns A function that takes a property key and returns its descriptor
 */
function createDescriptorExtractor(
	config: ProcessorConfigDTO
): (key: string) => PropertyDescriptorDTO | undefined {
	const descriptors = config.descriptors ?? {};

	return (key: string): PropertyDescriptorDTO | undefined => {
		const rawDesc = descriptors[key];
		if (!rawDesc) return undefined;

		return 'propertyDescriptor' in rawDesc
			? rawDesc.propertyDescriptor
			: rawDesc as PropertyDescriptorDTO;
	};
}


