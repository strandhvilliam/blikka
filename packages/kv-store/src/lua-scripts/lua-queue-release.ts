export const luaQueueRelease = `
-- KEYS[1] = activeKey (ZSET)
--
-- ARGV[1] = member
-- ARGV[2] = leaseId
-- ARGV[3] = leaseKeyPrefix
--
-- Returns:
--   { "RELEASED" }
--   { "NOT_ACTIVE" }
--   { "LEASE_MISMATCH" }

local activeKey = KEYS[1]

local member = ARGV[1]
local leaseId = ARGV[2]
local leaseKeyPrefix = ARGV[3]

local score = redis.call("ZSCORE", activeKey, member)
if not score then
  return { "NOT_ACTIVE" }
end

local leaseKey = leaseKeyPrefix .. member
local currentLeaseId = redis.call("GET", leaseKey)
if not currentLeaseId or currentLeaseId ~= leaseId then
  return { "LEASE_MISMATCH" }
end

redis.call("ZREM", activeKey, member)
redis.call("DEL", leaseKey)

return { "RELEASED" }
`


