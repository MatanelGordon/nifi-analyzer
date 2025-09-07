# Apache NiFi Database Schema Documentation

This document describes the database schema for analyzing Apache NiFi processors, connections, and their properties. Apache NiFi is a dataflow system that enables data routing, transformation, and system mediation logic.

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
| averageLineageDuration | REAL NOT NULL | Average duration of data lineage in milliseconds |
| bytesWritten | INTEGER NOT NULL | Number of bytes written |
| outputCount | INTEGER NOT NULL | Count of output flowfiles |
| bytesTransferred | INTEGER NOT NULL | Number of bytes transferred |
| flowFilesRemoved | INTEGER NOT NULL | Count of removed flowfiles |
| bytesRead | INTEGER NOT NULL | Number of bytes read |
| taskNanos | INTEGER NOT NULL | Task duration in nanoseconds |
| averageTaskNanos | REAL NOT NULL | Average task duration in nanoseconds |
| outputBytes | INTEGER NOT NULL | Number of output bytes |
| taskCount | INTEGER NOT NULL | Number of tasks executed |
| inputBytes | INTEGER NOT NULL | Number of input bytes |
| taskMillis | INTEGER NOT NULL | Task duration in milliseconds |
| inputCount | INTEGER NOT NULL | Count of input flowfiles |

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
