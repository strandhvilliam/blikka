export const luaQueueStatusOrAcquire = `
-- KEYS[1] = waitingKey (ZSET)
-- KEYS[2] = activeKey  (ZSET)
--
-- ARGV[1] = member (e.g. "domain:reference")
-- ARGV[2] = limit (number)
-- ARGV[3] = leaseTtlMs (number)
-- ARGV[4] = leaseKeyPrefix (e.g. "upload-q:lease:")
-- ARGV[5] = pollMinMs (number)
--
-- Returns:
--   { "GRANTED", leaseId, leaseExpiresAtMs, activeCount, limit }
--   { "WAIT", position, activeCount, limit, pollAfterMs }

local t = redis.call("TIME")
local nowMs = (t[1] * 1000) + math.floor(t[2] / 1000)

local waitingKey = KEYS[1]
local activeKey = KEYS[2]

local member = ARGV[1]
local limit = tonumber(ARGV[2])
local leaseTtlMs = tonumber(ARGV[3])
local leaseKeyPrefix = ARGV[4]
local pollMinMs = tonumber(ARGV[5])

if not member or member == "" then
  return { "WAIT", -1, -1, limit or -1, pollMinMs or 1000 }
end

-- Remove expired actives (leases expire)
redis.call("ZREMRANGEBYSCORE", activeKey, "-inf", nowMs)

-- Enqueue once (stable position)
redis.call("ZADD", waitingKey, "NX", nowMs, member)

-- If already active, ensure lease key exists and return GRANTED
local activeScore = redis.call("ZSCORE", activeKey, member)
if activeScore then
  local leaseKey = leaseKeyPrefix .. member
  local existingLeaseId = redis.call("GET", leaseKey)
  if not existingLeaseId then
    math.randomseed(nowMs)
    local newLeaseId = redis.sha1hex(member .. ":" .. tostring(nowMs) .. ":" .. tostring(math.random(1000000)))
    local newExpiresAt = nowMs + leaseTtlMs
    redis.call("SET", leaseKey, newLeaseId, "PX", leaseTtlMs)
    redis.call("ZADD", activeKey, "XX", newExpiresAt, member)
    return { "GRANTED", newLeaseId, newExpiresAt, redis.call("ZCARD", activeKey), limit }
  end
  return { "GRANTED", existingLeaseId, tonumber(activeScore), redis.call("ZCARD", activeKey), limit }
end

-- Promote head-of-line while there is capacity
local activeCount = tonumber(redis.call("ZCARD", activeKey))
while activeCount < limit do
  local head = redis.call("ZRANGE", waitingKey, 0, 0)
  if not head or not head[1] then
    break
  end

  local nextMember = head[1]
  redis.call("ZREM", waitingKey, nextMember)

  local expiresAt = nowMs + leaseTtlMs
  redis.call("ZADD", activeKey, expiresAt, nextMember)

  math.randomseed(nowMs)
  local leaseId = redis.sha1hex(nextMember .. ":" .. tostring(nowMs) .. ":" .. tostring(math.random(1000000)))
  redis.call("SET", leaseKeyPrefix .. nextMember, leaseId, "PX", leaseTtlMs)

  activeCount = activeCount + 1
end

-- Caller may have become active via promotion
local newActiveScore = redis.call("ZSCORE", activeKey, member)
if newActiveScore then
  local leaseId = redis.call("GET", leaseKeyPrefix .. member)
  if not leaseId then
    math.randomseed(nowMs)
    leaseId = redis.sha1hex(member .. ":" .. tostring(nowMs) .. ":" .. tostring(math.random(1000000)))
    redis.call("SET", leaseKeyPrefix .. member, leaseId, "PX", leaseTtlMs)
    redis.call("ZADD", activeKey, "XX", nowMs + leaseTtlMs, member)
    newActiveScore = nowMs + leaseTtlMs
  end
  return { "GRANTED", leaseId, tonumber(newActiveScore), redis.call("ZCARD", activeKey), limit }
end

-- Otherwise, return WAIT with position and a reasonable poll delay.
local position = redis.call("ZRANK", waitingKey, member)
if not position then
  position = -1
end

local pollAfterMs = pollMinMs or 1000
local minActive = redis.call("ZRANGE", activeKey, 0, 0, "WITHSCORES")
if minActive and minActive[2] then
  local earliestExpiry = tonumber(minActive[2])
  if earliestExpiry and earliestExpiry > nowMs then
    local untilFree = earliestExpiry - nowMs
    -- Clamp to avoid clients sleeping too long and to keep responsiveness.
    if untilFree < pollAfterMs then
      pollAfterMs = untilFree
    end
    if pollAfterMs < 250 then
      pollAfterMs = 250
    end
  end
end

return { "WAIT", tonumber(position), redis.call("ZCARD", activeKey), limit, tonumber(pollAfterMs) }
`


