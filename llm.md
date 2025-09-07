# Apache NiFi Database Schema Documentation

This document describes the database schema for analyzing Apache NiFi processors, connections, and their properties. Apache NiFi is a dataflow system that enables data routing, transformation, and system mediation logic.

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

Note for LLMs: When querying this schema:
- Use JOINs with connections_targets when you need source/destination names
- Use processor_id to link processor properties with their main info
- Timestamp in processors_status_history is Unix timestamp (milliseconds)
- Properties in processors_properties are key-value pairs for each processor
- Back pressure thresholds may use different units (count vs size)
