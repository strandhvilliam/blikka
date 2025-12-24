export const luaQueueCancel = `
-- KEYS[1] = waitingKey (ZSET)
--
-- ARGV[1] = member
--
-- Returns:
--   { "CANCELLED", removedCount }

local waitingKey = KEYS[1]
local member = ARGV[1]

local removed = redis.call("ZREM", waitingKey, member)
return { "CANCELLED", removed }
`


