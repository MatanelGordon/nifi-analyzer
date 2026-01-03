# Apache NiFi Database Schema Documentation

This document describes the SQLITE database schemas for analyzing Apache NiFi processors, connections, and their properties. Apache NiFi is a dataflow system that enables data routing, transformation, and system mediation logic.

## Core NiFi Concepts

### Processors

A processor is the fundamental building block in NiFi that is responsible for:

- Creating, sending, receiving, transforming, routing, splitting, merging, and processing FlowFiles
- Each processor is designed to perform a specific task
- Examples: GetFile, PutFile, ConvertRecord, ExecuteSQL, InvokeHTTP

#### Advanced Processor Configuration

- Run Duration: The amount of time a processor will run for each scheduled execution
  - Longer durations can increase throughput but may impact latency
  - Short durations provide better responsiveness but have more scheduling overhead
- Concurrent Tasks: Number of tasks that can execute simultaneously for this processor
  - Higher concurrency can improve throughput for I/O bound tasks
  - Too many concurrent tasks can overwhelm downstream processors
- Penalty Duration: Time period during which a FlowFile is penalized after failed processing
  - Penalized FlowFiles return to the queue but won't be processed until penalty expires
  - Helps prevent repeated rapid failure of the same FlowFile
- Yield Duration: Time a processor will wait before trying again after encountering an issue
  - Used when the processor itself needs to back off (e.g., remote service unavailable)
  - Different from penalty duration which applies to individual FlowFiles

### Connections

A connection represents a link between components (usually processors) in the flow:

- Acts as a queue for FlowFiles waiting to be processed
- Enables back pressure to prevent overwhelming downstream processors
- Can be configured for load balancing in a cluster
- Maintains order of FlowFiles unless otherwise configured

#### Advanced Connection Configuration

- Back Pressure:
  - Object Count Threshold: Maximum number of FlowFiles in the queue
  - Object Size Threshold: Maximum total size of FlowFiles in the queue
  - When thresholds are exceeded, upstream processors stop scheduling
- Load Balancing:
  - Distributes FlowFiles across multiple nodes in a cluster
  - Can be based on round robin, single node, or attributes
- FlowFile Expiration:
  - Time after which FlowFiles in the queue are considered expired
  - Helps prevent stale data from being processed

### Process Groups

A Process Group is a container for organizing and managing dataflows:

- Groups related processors and connections into logical units
- Enables hierarchical dataflow management
- Can have input and output ports for communication with other process groups
- Allows for reuse of common flow patterns
- Helps manage complex flows by providing encapsulation

## Tables Overview

### processors_info

Stores the main information about NiFi processors. Each processor represents a data processing unit in the NiFi flow.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR PRIMARY KEY | Unique identifier of the processor |
| name | VARCHAR NOT NULL | Display name of the processor |
| type | VARCHAR NOT NULL | Processor type (e.g., UpdateAttribute, RouteOnAttribute) |
| run_duration | INTEGER NOT NULL | Duration of processor execution in milliseconds |
| concurrent_tasks | INTEGER NOT NULL | Number of tasks that can run concurrently |
| scheduling_strategy | TEXT NOT NULL | How the processor is scheduled (TIMER_DRIVEN, CRON_DRIVEN, etc.) |
| run_schedule | VARCHAR NOT NULL | Schedule period or CRON expression |
| execution | VARCHAR NOT NULL | Execution mode (RUNNING, STOPPED, etc.) |
| comments | VARCHAR | Optional user comments about the processor |

### processors_properties

Stores the configuration properties of each processor. Each processor can have multiple properties.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR PRIMARY KEY | Unique identifier for the property |
| processor_id | VARCHAR NOT NULL | Reference to the processor (FK to processors_info.id) |
| name | VARCHAR NOT NULL | Name of the property |
| value | VARCHAR | Value of the property |

### nodes_info

Stores information about NiFi nodes in a cluster setup.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR PRIMARY KEY | Unique identifier of the node |
| address | VARCHAR NOT NULL | Network address of the node |
| api_port | INTEGER NOT NULL | Port number for the node's API |

### processors_status_history

Records historical performance metrics for processors across nodes.

| Column | Type | Description |
|--------|------|-------------|
| processor_id | VARCHAR | Reference to the processor (FK to processors_info.id) |
| node_id | VARCHAR | Reference to the node (FK to nodes_info.id) |
| timestamp | INTEGER NOT NULL | Timestamp of the metrics record |
| average_lineage_duration | REAL NOT NULL | Average duration of data lineage in milliseconds |
| bytes_written | INTEGER NOT NULL | Number of bytes written |
| output_count | INTEGER NOT NULL | Count of output flowfiles |
| bytes_transferred | INTEGER NOT NULL | Number of bytes transferred |
| flow_files_removed | INTEGER NOT NULL | Count of removed flowfiles |
| bytes_read | INTEGER NOT NULL | Number of bytes read |
| task_nanos | INTEGER NOT NULL | Task duration in nanoseconds |
| average_task_nanos | REAL NOT NULL | Average task duration in nanoseconds |
| output_bytes | INTEGER NOT NULL | Number of output bytes |
| task_count | INTEGER NOT NULL | Number of tasks executed |
| input_bytes | INTEGER NOT NULL | Number of input bytes |
| task_millis | INTEGER NOT NULL | Task duration in milliseconds |
| input_count | INTEGER NOT NULL | Count of input flowfiles |

### connections_targets

Stores information about connection endpoints (sources and destinations).

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR PRIMARY KEY | Unique identifier of the connection endpoint |
| name | VARCHAR NOT NULL | Name of the endpoint |
| type | VARCHAR NOT NULL | Type of the endpoint (PROCESSOR, FUNNEL, etc.) |

### connections_info

Stores information about connections between processors and other components.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR PRIMARY KEY | Unique identifier of the connection |
| name | VARCHAR NOT NULL | Name of the connection |
| source_id | VARCHAR NOT NULL | Source endpoint ID (FK to connections_targets.id) |
| destination_id | VARCHAR NOT NULL | Destination endpoint ID |
| is_load_balanced | BOOLEAN NOT NULL | Whether load balancing is enabled |
| load_balance_strategy | VARCHAR | Strategy used for load balancing |
| load_balance_partition_attribute | VARCHAR | Attribute used for partitioning in load balancing |
| load_balance_compression | VARCHAR | Compression type for load balanced data |
| load_balance_status | VARCHAR | Current status of load balancing |
| back_pressure_object_threshold | INTEGER | Maximum number of objects for back pressure |
| back_pressure_data_size_threshold | VARCHAR | Maximum data size for back pressure |
| flow_file_expiration | VARCHAR | Duration after which flowfiles expire |

### provenance_events

Stores provenance event records that track the lifecycle and transformations of FlowFiles through the NiFi dataflow. Each row represents a single event that occurred to a FlowFile, such as creation, modification, routing, or deletion.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique identifier for the provenance event |
| event_time | INTEGER | Timestamp when the event occurred (Unix timestamp in milliseconds) |
| event_duration | INTEGER | Duration of the event in milliseconds |
| lineage_duration | INTEGER | Total time the FlowFile has been in the system in milliseconds |
| event_type | VARCHAR | Type of event (CREATE, RECEIVE, SEND, FETCH, EXPIRE, DROP, etc.) |
| flowfile_uuid | VARCHAR NOT NULL | Unique identifier of the FlowFile associated with this event |
| flowfile_size_bytes | INTEGER | Size of the FlowFile in bytes at the time of this event |
| pg_id | VARCHAR | Process Group ID where the event occurred |
| processor_id | VARCHAR | Processor ID that generated this event (FK to processors_info.id) |
| content_equal | INTEGER | Boolean flag indicating if content remained unchanged (0=false, 1=true) |
| node_id | VARCHAR | Node ID where the event occurred in a cluster setup |

### provenance_events_attributes

Stores FlowFile attributes associated with each provenance event. This table provides metadata and context about the FlowFile at the time of the event, including custom attributes set by processors.

| Column | Type | Description |
|--------|------|-------------|
| event_id | INTEGER NOT NULL | Reference to the provenance event (FK to provenance_events.id) |
| flowfile_uuid | VARCHAR NOT NULL | FlowFile UUID for quick lookup |
| name | VARCHAR NOT NULL | Name of the attribute |
| value | VARCHAR NOT NULL | Value of the attribute |
| PRIMARY KEY | (event_id, name, flowfile_uuid) | Composite primary key |

### provenance_events_flowfile_relationships

Stores parent-child relationships between FlowFiles that result from splitting, merging, or other operations that create or modify FlowFile lineage. This table tracks how FlowFiles are related to each other through processing events.

| Column | Type | Description |
|--------|------|-------------|
| event_id | INTEGER NOT NULL | Reference to the provenance event (FK to provenance_events.id) |
| parent_flowfile_uuid | VARCHAR NOT NULL | UUID of the parent FlowFile |
| child_flowfile_uuid | VARCHAR NOT NULL | UUID of the child FlowFile |
| PRIMARY KEY | (event_id, parent_flowfile_uuid, child_flowfile_uuid) | Composite primary key |

## Important Analysis Notes

### Performance Bottleneck Analysis

When analyzing NiFi flow performance, consider these key points:

1. HTTP-Based Processors:
    - Processors of type 'InvokeHTTP' are common bottleneck sources.
    - Their performance depends on external server response times.
    - Always include these in performance analysis queries.
    - Consider them high-risk for flow delays.

2. Aggregated Metrics:
    - The `processors_status_history` table contains both per-node and aggregated metrics.
    - Aggregated metrics are linked to a special node with `node_id = 'TOTAL'` in `nodes_info` table.
    - Use this for overall flow performance analysis.
    - Example: `WHERE node_id = 'TOTAL'` to get system-wide metrics.

3. Load Balancer Impact:
    - Connections with load balancers (`is_load_balanced = TRUE`) require special attention.
    - They can become bottlenecks due to distribution overhead.
    - Monitor these connections more closely for performance issues.
    - Consider analyzing their metrics alongside processor performance.

4. Find processors that took the longest to execute:
    - Use this to identify processors that inherently function slower than others.
    - Good candidates for increasing concurrent tasks to improve throughput.
    - Shows the maximum observed task duration per processor.
    - Example prompt:

```sql
SELECT MAX(psh.task_millis) / 1000 AS duration, psh.processor_id AS processor_id, pi.name AS name, pi.type AS type
FROM processors_status_history psh
JOIN processors_info pi ON psh.processor_id = pi.id
WHERE psh.task_millis > 0
GROUP BY psh.processor_id
ORDER BY MAX(psh.task_millis) DESC;
```

5. Find processors with high average lineage duration:
    - Identifies processors that may not handle the volume of flowfiles efficiently.
    - High average lineage duration suggests a bottleneck in processing throughput.
    - Consider increasing concurrent tasks and run duration for these processors.
    - Example prompt:

```sql
SELECT psh.processor_id AS processor_id,
         MAX(psh.average_lineage_duration) as average_lineage,
         pi.type as type,
         pi.name as name
FROM processors_status_history psh
JOIN processors_info pi ON psh.processor_id = pi.id
WHERE psh.average_lineage_duration > 0
GROUP BY processor_id
ORDER BY average_lineage
```

6. Find processors with run_duration too high:
    - Processors with high run_duration may increase throughput but also increase latency.
    - Useful for identifying where to tune run duration for better performance.
    - Example prompt:

```sql
SELECT * FROM processors_info
WHERE run_duration >= 1000
```

## Example Queries

### Get High-Duration Processors

Retrieves processors with run duration > 500ms:

```sql
SELECT 
    name,
    id,
    run_duration,
    concurrent_tasks
FROM processors_info
WHERE run_duration > 500
ORDER BY run_duration DESC;
```

### Get Load-Balanced Connections

Retrieves all connections that have load balancing enabled:

```sql
SELECT 
    c.name AS connection_name,
    src.name AS source_name,
    dst.name AS destination_name,
    c.load_balance_strategy,
    c.load_balance_partition_attribute
FROM connections_info c
JOIN connections_targets src ON c.source_id = src.id
JOIN connections_targets dst ON c.destination_id = dst.id
WHERE c.is_load_balanced = TRUE;
```

### Get Most Time-Consuming Processor Types

Retrieves processor types ordered by their average task duration and lineage duration:

```sql
SELECT 
    p.type AS processor_type,
    AVG(h.taskMillis) AS avg_task_millis,
    AVG(h.averageLineageDuration) AS avg_lineage_duration
FROM processors_info p
JOIN processors_status_history h ON p.id = h.processor_id
GROUP BY p.type
ORDER BY avg_task_millis DESC;
```

This query:

- Groups processors by their type
- Calculates average processing time (taskMillis) for each type
- Calculates average lineage duration (time data spends in the flow) for each type
- Orders results to show most time-consuming processor types first

### Find Biggest FlowFiles with Specific Attribute Condition

Retrieves the top 5 largest FlowFiles where the attribute 'a' has a length greater than 4:

```sql
SELECT 
    pe.flowfile_uuid,
    pe.flowfile_size_bytes,
    pe.event_type,
    pe.event_time,
    pea.value AS attribute_a_value
FROM provenance_events pe
JOIN provenance_events_attributes pea ON pe.id = pea.event_id
WHERE pea.name = 'a' 
    AND LENGTH(pea.value) > 4
ORDER BY pe.flowfile_size_bytes DESC
LIMIT 5;
```

This query:

- Joins provenance_events with provenance_events_attributes tables
- Filters for events where attribute name is 'a' and value length > 4
- Orders by FlowFile size in descending order
- Returns the top 5 largest FlowFiles meeting the criteria
- Includes additional context like event type and timestamp

Note for LLMs: When querying this schema:

- Use JOINs with connections_targets when you need source/destination names
- Use processor_id to link processor properties with their main info
- Timestamp in processors_status_history is Unix timestamp (milliseconds)
- Properties in processors_properties are key-value pairs for each processor
- Back pressure thresholds may use different units (count vs size)
- Provenance events track the complete lifecycle of FlowFiles through the system
- Use provenance_events_attributes to filter or analyze based on FlowFile metadata
- FlowFile relationships show parent-child connections from splitting/merging operations
- Nifi References md files are at `./nifi/md`. read those files to have a better understanding about Apache Nifi.

### Recursive Query: Get All Connected Processors with Combined Status History

Retrieves all processors in the path from a source component to a destination component, along with their individual status history data points for time-series analysis:

```sql
WITH RECURSIVE processor_path AS (
    -- Base case: start from the source component
    SELECT 
        c.destination_id AS component_id,
        c.source_id AS path_source,
        1 AS depth,
        c.destination_id AS path
    FROM connections_info c
    WHERE c.source_id = 'SOURCE_COMPONENT_ID'  -- Replace with actual source component ID
    
    UNION ALL
    
    -- Recursive case: follow connections from current component
    SELECT 
        c.destination_id AS component_id,
        pp.path_source,
        pp.depth + 1,
        pp.path || ' -> ' || c.destination_id AS path
    FROM connections_info c
    JOIN processor_path pp ON c.source_id = pp.component_id
    WHERE pp.depth < 50  -- Prevent infinite loops
        AND c.destination_id != 'SOURCE_COMPONENT_ID'  -- Prevent cycles
        AND pp.component_id != 'DESTINATION_COMPONENT_ID'  -- Stop when reaching destination
)
SELECT 
    pp.component_id,
    ct.name AS processor_name,
    ct.type AS processor_type,
    pp.depth AS distance_from_source,
    pp.path AS connection_path,
    -- Individual status history data points for each timestamp and node
    psh.node_id,
    psh.timestamp,
    psh.average_lineage_duration,
    psh.bytes_read,
    psh.bytes_written,
    psh.bytes_transferred,
    psh.input_count,
    psh.output_count,
    psh.input_bytes,
    psh.output_bytes,
    psh.task_millis,
    psh.task_nanos,
    psh.average_task_nanos,
    psh.task_count,
    psh.flow_files_removed
FROM processor_path pp
JOIN connections_targets ct ON pp.component_id = ct.id
LEFT JOIN processors_status_history psh ON ct.id = psh.processor_id
WHERE ct.type = 'PROCESSOR'  -- Filter for processors only
ORDER BY pp.depth, pp.component_id, psh.timestamp;
```

This query:

- Uses a recursive CTE to traverse the connection graph from source to destination
- Tracks the depth (distance) from the source component
- Builds a visual path showing the connection flow
- Joins with `connections_targets` to get processor details
- Returns individual data points (not aggregated) for each processor at each timestamp and node
- Prevents infinite loops with a depth limit and cycle detection
- Filters to include only processors (not funnels or ports)
- Orders by depth, component, and timestamp for easy time-series visualization

To use this query:

1. Replace `'SOURCE_COMPONENT_ID'` with the starting processor/component ID
2. Replace `'DESTINATION_COMPONENT_ID'` with the ending processor/component ID (or remove this condition to get all downstream processors)
3. Adjust the depth limit (50) based on your flow complexity
4. Add time-based filters like `AND psh.timestamp BETWEEN <start> AND <end>` to limit the time range
5. Filter by specific node using `AND psh.node_id = 'TOTAL'` for aggregated metrics or specific node IDs

Use cases:

- Creating time-series charts for each processor's performance metrics
- Comparing processor performance across different nodes in a cluster
- Analyzing end-to-end performance of a data processing pipeline over time
- Identifying bottlenecks in a specific flow path at different time periods
- Building dashboards with historical trends for connected processors

### Time Bucketing: Aggregate Processor Metrics by Time Intervals

Groups processor status history data into 10-minute time buckets and calculates the average lineage duration for each bucket. This is useful for analyzing performance trends over time and identifying patterns or anomalies.

```sql
SELECT 
    psh.processor_id,
    pi.name AS processor_name,
    pi.type AS processor_type,
    -- Create 10-minute time buckets using strftime
    strftime('%Y-%m-%d %H:', datetime(psh.timestamp / 1000, 'unixepoch')) || 
    printf('%02d', (CAST(strftime('%M', datetime(psh.timestamp / 1000, 'unixepoch')) AS INTEGER) / 10) * 10) AS time_bucket,
    AVG(psh.average_lineage_duration) AS avg_lineage_duration,
    COUNT(*) AS data_points_in_bucket,
    MIN(psh.average_lineage_duration) AS min_lineage_duration,
    MAX(psh.average_lineage_duration) AS max_lineage_duration
FROM processors_status_history psh
JOIN processors_info pi ON psh.processor_id = pi.id
WHERE psh.average_lineage_duration > 0
    AND psh.node_id = 'TOTAL'  -- Use aggregated metrics across all nodes
GROUP BY psh.processor_id, time_bucket
ORDER BY psh.processor_id, time_bucket;
```

This query:

- Converts Unix timestamp (milliseconds) to datetime format
- Groups data into 10-minute intervals (00, 10, 20, 30, 40, 50 minutes)
- Calculates average lineage duration for each processor within each time bucket
- Includes additional statistics (min, max, count) for better analysis
- Filters for aggregated metrics using `node_id = 'TOTAL'`
- Orders results by processor and time for easy time-series visualization

Alternative: Simpler 10-minute bucketing using Unix timestamp arithmetic:

```sql
SELECT 
    psh.processor_id,
    pi.name AS processor_name,
    -- Simple bucketing: round timestamp down to nearest 10 minutes (600000 milliseconds)
    (psh.timestamp / 600000) * 600000 AS time_bucket_ms,
    datetime((psh.timestamp / 600000) * 600000 / 1000, 'unixepoch') AS time_bucket_readable,
    AVG(psh.average_lineage_duration) AS avg_lineage_duration,
    COUNT(*) AS data_points
FROM processors_status_history psh
JOIN processors_info pi ON psh.processor_id = pi.id
WHERE psh.average_lineage_duration > 0
    AND psh.node_id = 'TOTAL'
GROUP BY psh.processor_id, time_bucket_ms
ORDER BY psh.processor_id, time_bucket_ms;
```

Use cases:

- Identifying performance degradation patterns over time
- Comparing processor performance across different time periods
- Creating time-series visualizations and dashboards
- Detecting anomalies by comparing buckets
- Analyzing the impact of configuration changes or system events
- Smoothing out noisy data for trend analysis

### Per-Node Analysis: Task Count by Node

Analyzes the number of tasks executed by specific processor types across different nodes in a cluster. This example shows InvokeHTTP processors' task counts per node in the last 5 minutes, useful for identifying load distribution and node-specific performance issues.

```sql
SELECT 
    pi.name AS processor_name,
    pi.type AS processor_type,
    psh.node_id,
    ni.address AS node_address,
    SUM(psh.task_count) AS total_tasks,
    AVG(psh.task_count) AS avg_tasks_per_sample,
    MAX(psh.task_count) AS max_tasks_per_sample,
    COUNT(*) AS sample_count,
    MIN(datetime(psh.timestamp / 1000, 'unixepoch')) AS first_sample,
    MAX(datetime(psh.timestamp / 1000, 'unixepoch')) AS last_sample
FROM processors_status_history psh
JOIN processors_info pi ON psh.processor_id = pi.id
LEFT JOIN nodes_info ni ON psh.node_id = ni.id
WHERE pi.type LIKE '%InvokeHTTP%'
    AND psh.node_id != 'TOTAL'  -- Exclude aggregated metrics, show per-node only
    AND psh.timestamp >= (strftime('%s', 'now') - 300) * 1000  -- Last 5 minutes (300 seconds)
GROUP BY pi.id, psh.node_id
ORDER BY total_tasks DESC, processor_name, node_id;
```

This query:

- Filters for InvokeHTTP processors specifically
- Excludes the 'TOTAL' aggregated metrics to show individual node performance
- Limits results to the last 5 minutes using Unix timestamp comparison
- Calculates total, average, and maximum task counts per node
- Joins with `nodes_info` to show human-readable node addresses
- Shows the time range of samples included in the aggregation
- Orders by total tasks to identify the busiest processor/node combinations

Alternative: Compare node performance for a specific processor:

```sql
SELECT 
    psh.node_id,
    ni.address AS node_address,
    AVG(psh.task_count) AS avg_tasks,
    AVG(psh.average_task_nanos) / 1000000 AS avg_task_duration_ms,
    AVG(psh.input_count) AS avg_input,
    AVG(psh.output_count) AS avg_output,
    COUNT(*) AS samples
FROM processors_status_history psh
LEFT JOIN nodes_info ni ON psh.node_id = ni.id
WHERE psh.processor_id = 'PROCESSOR_ID_HERE'  -- Replace with specific processor ID
    AND psh.node_id != 'TOTAL'
    AND psh.timestamp >= (strftime('%s', 'now') - 300) * 1000
GROUP BY psh.node_id
ORDER BY avg_tasks DESC;
```

Use cases:

- Identifying uneven load distribution across cluster nodes
- Detecting node-specific performance issues or bottlenecks
- Monitoring high-traffic processors like InvokeHTTP in real-time
- Comparing node performance to identify hardware or network issues
- Validating load balancing configuration effectiveness
- Troubleshooting cluster-specific problems

### Lineage Duration Gaps: Find Bottlenecks Between Connected Processors

Analyzes the difference in average lineage duration between connected processors to identify where FlowFiles spend the most time waiting or processing. Large gaps indicate potential bottlenecks in the dataflow pipeline.

```sql
SELECT 
    ci.name AS connection_name,
    src.name AS source_processor,
    dst.name AS destination_processor,
    src.type AS source_type,
    dst.type AS destination_type,
    AVG(src_history.average_lineage_duration) AS source_avg_lineage,
    AVG(dst_history.average_lineage_duration) AS destination_avg_lineage,
    AVG(dst_history.average_lineage_duration - src_history.average_lineage_duration) AS avg_lineage_gap,
    MAX(dst_history.average_lineage_duration - src_history.average_lineage_duration) AS max_lineage_gap,
    COUNT(*) AS sample_count
FROM connections_info ci
JOIN connections_targets src ON ci.source_id = src.id
JOIN connections_targets dst ON ci.destination_id = dst.id
JOIN processors_status_history src_history ON src.id = src_history.processor_id
JOIN processors_status_history dst_history ON dst.id = dst_history.processor_id
WHERE src.type = 'PROCESSOR'
    AND dst.type = 'PROCESSOR'
    AND src_history.node_id = 'TOTAL'
    AND dst_history.node_id = 'TOTAL'
    AND src_history.timestamp = dst_history.timestamp  -- Match same time samples
    AND dst_history.average_lineage_duration > src_history.average_lineage_duration  -- Only positive gaps
GROUP BY ci.id
HAVING avg_lineage_gap > 0
ORDER BY avg_lineage_gap DESC
LIMIT 20;
```

This query:

- Joins connections with their source and destination processors
- Matches status history records from the same timestamp for accurate comparison
- Calculates the difference in lineage duration between connected processors
- Filters for positive gaps (where destination has higher lineage than source)
- Uses aggregated metrics (`node_id = 'TOTAL'`) for overall system view
- Orders by average gap to identify the worst bottlenecks
- Includes max gap to see peak performance issues

Alternative: Find gaps with time-based filtering and additional context:

```sql
SELECT 
    ci.name AS connection_name,
    src.name AS source_processor,
    dst.name AS destination_processor,
    pi_src.concurrent_tasks AS source_concurrent_tasks,
    pi_dst.concurrent_tasks AS dest_concurrent_tasks,
    pi_src.run_duration AS source_run_duration,
    pi_dst.run_duration AS dest_run_duration,
    AVG(dst_history.average_lineage_duration - src_history.average_lineage_duration) AS avg_lineage_gap_ms,
    AVG(dst_history.average_lineage_duration - src_history.average_lineage_duration) / 1000.0 AS avg_lineage_gap_seconds,
    AVG(dst_history.task_millis) AS dest_avg_task_duration,
    AVG(dst_history.input_count) AS dest_avg_input_count,
    ci.back_pressure_object_threshold,
    ci.is_load_balanced
FROM connections_info ci
JOIN connections_targets src ON ci.source_id = src.id
JOIN connections_targets dst ON ci.destination_id = dst.id
JOIN processors_info pi_src ON src.id = pi_src.id
JOIN processors_info pi_dst ON dst.id = pi_dst.id
JOIN processors_status_history src_history ON src.id = src_history.processor_id
JOIN processors_status_history dst_history ON dst.id = dst_history.processor_id
WHERE src.type = 'PROCESSOR'
    AND dst.type = 'PROCESSOR'
    AND src_history.node_id = 'TOTAL'
    AND dst_history.node_id = 'TOTAL'
    AND src_history.timestamp = dst_history.timestamp
    AND dst_history.average_lineage_duration > src_history.average_lineage_duration
    AND src_history.timestamp >= (strftime('%s', 'now') - 3600) * 1000  -- Last hour
GROUP BY ci.id
HAVING avg_lineage_gap_ms > 100  -- Only gaps > 100ms
ORDER BY avg_lineage_gap_ms DESC;
```

This enhanced query:

- Adds processor configuration details (concurrent tasks, run duration)
- Includes connection properties (back pressure, load balancing)
- Shows destination processor's task duration and input count
- Filters for recent data (last hour)
- Converts gap to seconds for easier interpretation
- Only shows significant gaps (> 100ms)

Use cases:

- Identifying the slowest connections in your dataflow
- Finding processors that can't keep up with upstream throughput
- Prioritizing which processors need performance tuning (increase concurrent tasks, run duration)
- Detecting where back pressure might be occurring
- Analyzing the impact of load balancing on performance
- Planning capacity improvements by focusing on the biggest gaps
