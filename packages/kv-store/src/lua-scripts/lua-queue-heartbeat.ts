export const luaQueueHeartbeat = `
-- KEYS[1] = activeKey (ZSET)
--
-- ARGV[1] = member
-- ARGV[2] = leaseId
-- ARGV[3] = leaseTtlMs
-- ARGV[4] = leaseKeyPrefix
--
-- Returns:
--   { "OK", leaseExpiresAtMs }
--   { "NOT_ACTIVE" }
--   { "LEASE_MISMATCH" }

local t = redis.call("TIME")
local nowMs = (t[1] * 1000) + math.floor(t[2] / 1000)

local activeKey = KEYS[1]

local member = ARGV[1]
local leaseId = ARGV[2]
local leaseTtlMs = tonumber(ARGV[3])
local leaseKeyPrefix = ARGV[4]

local score = redis.call("ZSCORE", activeKey, member)
if not score then
  return { "NOT_ACTIVE" }
end

local leaseKey = leaseKeyPrefix .. member
local currentLeaseId = redis.call("GET", leaseKey)
if not currentLeaseId or currentLeaseId ~= leaseId then
  return { "LEASE_MISMATCH" }
end

local expiresAt = nowMs + leaseTtlMs
redis.call("ZADD", activeKey, "XX", expiresAt, member)
redis.call("PEXPIRE", leaseKey, leaseTtlMs)

return { "OK", expiresAt }
`


