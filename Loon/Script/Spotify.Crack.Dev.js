const ACCOUNT_ATTRIBUTES = {
  ads: { type: "bool", value: false },
  catalogue: { type: "string", value: "premium" },
  type: { type: "string", value: "premium" },
  "player-license": { type: "string", value: "premium" },
  "player-license-v2": { type: "string", value: "premium" },
  "on-demand": { type: "bool", value: true },
  unrestricted: { type: "bool", value: true },
  shuffle: { type: "bool", value: false },
  "shuffle-algorithm": { type: "string", value: "RANDOM" },
  "smart-shuffle": { type: "string", value: "AVAILABLE" },
  "pick-and-shuffle": { type: "bool", value: false },
  "high-bitrate": { type: "bool", value: true },
  "audio-quality": { type: "string", value: "1" },
  "loudness-levels": { type: "string", value: "1:-5.0,0.0,3.0:-2.0" },
  "payments-initial-campaign": { type: "string", value: "prepaid" },
  "social-session": { type: "bool", value: true },
  "social-session-free-tier": { type: "bool", value: false },
  "jam-social-session": { type: "string", value: "EXPANDED" },
  "mixing-tools": { type: "string", value: "EDIT" },
  "your-library-tags": { type: "bool", value: true },
  "can_use_superbird": { type: "bool", value: true },
  "is-euterpe": { type: "bool", value: true },
  "is-thalia": { type: "bool", value: true },
  "is-pigeon": { type: "bool", value: true },
  libspotify: { type: "bool", value: true },
  mobile: { type: "bool", value: true },
  name: { type: "string", value: "Spotify Premium" },
  "streaming-rules": { type: "string", value: "" },
  "com.spotify.madprops.use.ucs.product.state": { type: "bool", value: true },
  "com.spotify.madprops.delivered.by.ucs": { type: "bool", value: true },
};

const ALWAYS_DISABLED_PROPERTIES = new Map([
  ["core-ads\u0000music_adt_enabled", false],
  ["ios-feature-ondemandtrial\u0000enable_call_trials_facade", false],
]);

// Bump this when account or assigned-value mutations change, forcing one fresh response.
const CONFIG_CACHE_VERSION = "2026-08-14.1";
const CONFIG_ETAG_PREFIX = "spotify-protobuf";

function readVarint(bytes, offset, requireSafeInteger = true) {
  let value = 0;
  let multiplier = 1;

  for (let count = 0; count < 10 && offset < bytes.length; count++) {
    const byte = bytes[offset++];
    if (count === 9 && byte > 1) throw new Error("Invalid protobuf varint");

    value += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) {
      if (requireSafeInteger && !Number.isSafeInteger(value)) {
        throw new Error("Protobuf varint exceeds safe integer range");
      }
      return { value, offset };
    }
    multiplier *= 128;
  }

  throw new Error("Invalid protobuf varint");
}

function encodeVarint(value) {
  const bytes = [];
  let remaining = Number(value);

  if (!Number.isSafeInteger(remaining) || remaining < 0) {
    throw new Error(`Invalid protobuf integer: ${value}`);
  }

  do {
    let byte = remaining % 128;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining > 0);

  return Uint8Array.from(bytes);
}

function concatBytes(parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

function containsBytes(bytes, marker) {
  if (marker.length === 0) return true;

  const limit = bytes.length - marker.length;
  for (let start = 0; start <= limit; start++) {
    let matched = true;
    for (let index = 0; index < marker.length; index++) {
      if (bytes[start + index] !== marker[index]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }

  return false;
}

function skipFieldValue(bytes, offset, wireType, fieldNumber) {
  switch (wireType) {
    case 0:
      return readVarint(bytes, offset, false).offset;
    case 1:
      return offset + 8;
    case 2: {
      const length = readVarint(bytes, offset);
      return length.offset + length.value;
    }
    case 3: {
      while (offset < bytes.length) {
        const key = readVarint(bytes, offset);
        offset = key.offset;
        const nestedNumber = Math.floor(key.value / 8);
        const nestedWireType = key.value & 7;

        if (nestedWireType === 4) {
          if (nestedNumber !== fieldNumber) throw new Error("Mismatched protobuf group");
          return offset;
        }

        offset = skipFieldValue(bytes, offset, nestedWireType, nestedNumber);
      }
      throw new Error("Unterminated protobuf group");
    }
    case 5:
      return offset + 4;
    default:
      throw new Error(`Unsupported protobuf wire type: ${wireType}`);
  }
}

function parseMessage(bytes) {
  const fields = [];
  let offset = 0;

  while (offset < bytes.length) {
    const start = offset;
    const key = readVarint(bytes, offset);
    offset = key.offset;

    const number = Math.floor(key.value / 8);
    const wireType = key.value & 7;
    if (number === 0) throw new Error("Invalid protobuf field number");

    let data;
    let value;

    switch (wireType) {
      case 0: {
        const parsed = readVarint(bytes, offset, false);
        value = parsed.value;
        offset = parsed.offset;
        break;
      }
      case 1:
        offset += 8;
        break;
      case 2: {
        const length = readVarint(bytes, offset);
        offset = length.offset;
        const end = offset + length.value;
        if (end > bytes.length) throw new Error("Protobuf field exceeds message boundary");
        data = bytes.slice(offset, end);
        offset = end;
        break;
      }
      case 3:
        offset = skipFieldValue(bytes, offset, wireType, number);
        break;
      case 5:
        offset += 4;
        break;
      default:
        throw new Error(`Unsupported protobuf wire type: ${wireType}`);
    }

    if (offset > bytes.length) throw new Error("Truncated protobuf field");
    fields.push({ number, wireType, data, value, raw: bytes.slice(start, offset) });
  }

  return fields;
}

function encodeMessage(fields) {
  return concatBytes(fields.map((field) => field.raw));
}

function makeVarintField(number, value) {
  return {
    number,
    wireType: 0,
    value,
    raw: concatBytes([encodeVarint(number * 8), encodeVarint(value)]),
  };
}

function makeDelimitedField(number, data) {
  return {
    number,
    wireType: 2,
    data,
    raw: concatBytes([encodeVarint(number * 8 + 2), encodeVarint(data.length), data]),
  };
}

function replaceUniqueField(fields, number, replacement) {
  const result = [];
  let replaced = false;

  for (const field of fields) {
    if (field.number !== number) {
      result.push(field);
    } else if (!replaced) {
      result.push(replacement);
      replaced = true;
    }
  }

  if (!replaced) result.push(replacement);
  return result;
}

function removeFields(fields, numbers) {
  const targets = new Set(numbers);
  return fields.filter((field) => !targets.has(field.number));
}

function mutateAtPath(bytes, path, mutator) {
  if (path.length === 0) return mutator(bytes);

  const fields = parseMessage(bytes);
  const index = fields.findIndex(
    (field) => field.number === path[0] && field.wireType === 2,
  );

  if (index < 0) throw new Error(`Missing protobuf path field: ${path[0]}`);

  const child = mutateAtPath(fields[index].data, path.slice(1), mutator);
  if (child.changes === 0) return { bytes, changes: 0 };

  fields[index] = makeDelimitedField(path[0], child.bytes);
  return { bytes: encodeMessage(fields), changes: child.changes };
}

function encodeUtf8(value) {
  const bytes = [];

  for (let index = 0; index < value.length; index++) {
    let code = value.charCodeAt(index);

    if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const low = value.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        index++;
      }
    }

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }

  return Uint8Array.from(bytes);
}

function decodeUtf8(bytes) {
  let result = "";

  function continuation(index) {
    if (index >= bytes.length || (bytes[index] & 0xc0) !== 0x80) {
      throw new Error("Invalid UTF-8 string");
    }
    return bytes[index] & 0x3f;
  }

  for (let index = 0; index < bytes.length; index++) {
    const first = bytes[index];

    if (first < 0x80) {
      result += String.fromCharCode(first);
    } else if (first >= 0xc2 && first <= 0xdf) {
      const code = ((first & 0x1f) << 6) | continuation(++index);
      result += String.fromCharCode(code);
    } else if (first >= 0xe0 && first <= 0xef) {
      const second = continuation(++index);
      if ((first === 0xe0 && second < 0x20) || (first === 0xed && second >= 0x20)) {
        throw new Error("Invalid UTF-8 string");
      }
      const code =
        ((first & 0x0f) << 12) |
        (second << 6) |
        continuation(++index);
      result += String.fromCharCode(code);
    } else if (first >= 0xf0 && first <= 0xf4) {
      const second = continuation(++index);
      if ((first === 0xf0 && second < 0x10) || (first === 0xf4 && second >= 0x10)) {
        throw new Error("Invalid UTF-8 string");
      }
      let code =
        ((first & 7) << 18) |
        (second << 12) |
        (continuation(++index) << 6) |
        continuation(++index);
      code -= 0x10000;
      result += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else {
      throw new Error("Invalid UTF-8 string");
    }
  }

  return result;
}

function getStringField(fields, number) {
  const field = fields.find((item) => item.number === number && item.wireType === 2);
  return field ? decodeUtf8(field.data) : undefined;
}

function encodeAttribute(original, setting) {
  let fields = original.length ? parseMessage(original) : [];
  fields = removeFields(fields, [2, 3, 4]);

  if (setting.type === "bool") {
    fields.push(makeVarintField(2, setting.value ? 1 : 0));
  } else if (setting.type === "string") {
    fields.push(makeDelimitedField(4, encodeUtf8(setting.value)));
  } else {
    throw new Error(`Unsupported account attribute type: ${setting.type}`);
  }

  return encodeMessage(fields);
}

function makeAccountEntry(key, setting) {
  return encodeMessage([
    makeDelimitedField(1, encodeUtf8(key)),
    makeDelimitedField(2, encodeAttribute(new Uint8Array(), setting)),
  ]);
}

function mutateAccountAttributes(bytes, settings) {
  const fields = parseMessage(bytes);
  const pending = new Map(Object.entries(settings));
  let changes = 0;

  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    if (field.number !== 1 || field.wireType !== 2) continue;

    const entryFields = parseMessage(field.data);
    const key = getStringField(entryFields, 1);
    if (!pending.has(key)) continue;

    const setting = pending.get(key);
    const valueField = entryFields.find(
      (item) => item.number === 2 && item.wireType === 2,
    );
    const value = encodeAttribute(valueField?.data || new Uint8Array(), setting);
    const updatedEntry = replaceUniqueField(
      entryFields,
      2,
      makeDelimitedField(2, value),
    );

    fields[index] = makeDelimitedField(1, encodeMessage(updatedEntry));
    pending.delete(key);
    changes++;
  }

  for (const [key, setting] of pending) {
    fields.push(makeDelimitedField(1, makeAccountEntry(key, setting)));
    changes++;
  }

  return { bytes: encodeMessage(fields), changes };
}

function setAssignedBool(bytes, value) {
  let fields = parseMessage(bytes);
  fields = removeFields(fields, [3, 4, 5]);
  const boolValue = encodeMessage([makeVarintField(1, value ? 1 : 0)]);
  fields.push(makeDelimitedField(3, boolValue));
  return encodeMessage(fields);
}

function readPropertyId(assignedValue) {
  const fields = parseMessage(assignedValue);
  const property = fields.find(
    (field) => field.number === 1 && field.wireType === 2,
  );

  if (!property) return undefined;
  const propertyFields = parseMessage(property.data);
  const scope = getStringField(propertyFields, 1);
  const name = getStringField(propertyFields, 2);
  return scope && name ? { scope, name } : undefined;
}

function mutateAssignedValues(bytes, options) {
  const fields = parseMessage(bytes);
  const targets = new Map(ALWAYS_DISABLED_PROPERTIES);
  targets.set(
    "ios-system-your-plan-sidedrawer\u0000is_row_enabled",
    !options.removePremiumEntries,
  );
  targets.set("ios-feature-share\u0000is_useractivity_sharing_enabled", options.userActivity);

  let changes = 0;

  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    if (field.number !== 3 || field.wireType !== 2) continue;

    const property = readPropertyId(field.data);
    if (!property) continue;

    const key = `${property.scope}\u0000${property.name}`;
    if (!targets.has(key)) continue;

    fields[index] = makeDelimitedField(3, setAssignedBool(field.data, targets.get(key)));
    targets.delete(key);
    changes++;
  }

  return { bytes: encodeMessage(fields), changes };
}

function buildAccountSettings(options) {
  const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split(".")[0] + "Z";

  const settings = {
    ...ACCOUNT_ATTRIBUTES,
    "subscription-enddate": { type: "string", value: expiry },
    "product-expiry": { type: "string", value: expiry },
  };

  if (options.removePremiumEntries) {
    settings["nft-disabled"] = { type: "string", value: "1" };
  }

  return settings;
}

function mutateCustomizationSuccess(bytes, options) {
  let result = { bytes, changes: 0 };

  const attributes = mutateAtPath(result.bytes, [3], (value) =>
    mutateAccountAttributes(value, buildAccountSettings(options)),
  );
  result = {
    bytes: attributes.bytes,
    changes: result.changes + attributes.changes,
  };

  const assignedValues = mutateAtPath(result.bytes, [1, 1], (value) =>
    mutateAssignedValues(value, options),
  );

  return {
    bytes: assignedValues.bytes,
    changes: result.changes + assignedValues.changes,
  };
}

function removeBrowsitaBrandAds(bytes) {
  const marker = encodeUtf8("brand-ads-browse");
  const rootFields = parseMessage(bytes);
  let changes = 0;

  for (let index = 0; index < rootFields.length; index++) {
    const rootField = rootFields[index];
    if (rootField.number !== 1 || rootField.wireType !== 2) continue;

    const sections = parseMessage(rootField.data);
    const retained = sections.filter((section) => {
      const isBrandAd =
        section.number === 1 &&
        section.wireType === 2 &&
        containsBytes(section.data, marker);
      if (isBrandAd) changes++;
      return !isBrandAd;
    });

    if (retained.length !== sections.length) {
      rootFields[index] = makeDelimitedField(1, encodeMessage(retained));
    }
  }

  return {
    bytes: changes === 0 ? bytes : encodeMessage(rootFields),
    changes,
  };
}

function parseBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseArguments(raw) {
  let values = [];

  if (Array.isArray(raw)) {
    values = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    const text = raw.trim();
    try {
      const parsed = JSON.parse(text);
      values = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      values = text.replace(/^\[|\]$/g, "").split(",");
    }
  }

  return {
    removePremiumEntries: parseBoolean(values[0], true),
    userActivity: parseBoolean(values[1], true),
  };
}

function isConfigPath(path) {
  return (
    path === "/bootstrap/v1/bootstrap" ||
    path === "/user-customization-service/v1/customize"
  );
}

function configFingerprint(options) {
  return [
    CONFIG_CACHE_VERSION,
    options.removePremiumEntries ? "tab-on" : "tab-off",
    options.userActivity ? "handoff-on" : "handoff-off",
  ].join(":");
}

function stripWeakAndQuotes(value) {
  let result = value.trim();
  if (result.startsWith("W/")) result = result.slice(2).trim();
  if (result.startsWith('"') && result.endsWith('"')) result = result.slice(1, -1);
  return result;
}

function makeConfigEtag(original, options) {
  if (typeof original !== "string" || !original.trim()) return undefined;

  return [
    `"${CONFIG_ETAG_PREFIX}`,
    encodeURIComponent(configFingerprint(options)),
    `${encodeURIComponent(original.trim())}"`,
  ].join("|");
}

function parseConfigEtag(value) {
  if (typeof value !== "string") return undefined;

  const parts = stripWeakAndQuotes(value).split("|");
  if (parts.length !== 3 || parts[0] !== CONFIG_ETAG_PREFIX) return undefined;

  try {
    return {
      fingerprint: decodeURIComponent(parts[1]),
      original: decodeURIComponent(parts[2]),
    };
  } catch {
    return undefined;
  }
}

function findHeaderName(headers, target) {
  return Object.keys(headers).find((name) => name.toLowerCase() === target);
}

function processRequest(path, options) {
  if (!isConfigPath(path)) return {};

  const headers = { ...($request.headers || {}) };
  const etagHeader = findHeaderName(headers, "if-none-match");
  if (!etagHeader) return {};

  const cached = parseConfigEtag(headers[etagHeader]);
  const canRevalidate =
    cached &&
    cached.fingerprint === configFingerprint(options) &&
    typeof cached.original === "string" &&
    cached.original.length > 0;

  if (canRevalidate) {
    headers[etagHeader] = cached.original;
    console.log(`[Spotify] ${path}: revalidating the modified configuration cache`);
    return { headers };
  }

  delete headers[etagHeader];
  console.log(`[Spotify] ${path}: requesting a fresh configuration`);
  return { headers };
}

function responseBodyBytes(response) {
  const body = response.bodyBytes || response.body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }
  throw new Error("Spotify response body is not binary");
}

function cleanResponseHeaders(headers = {}) {
  const result = {};
  const invalid = new Set(["content-length", "content-encoding"]);

  for (const [name, value] of Object.entries(headers)) {
    if (!invalid.has(name.toLowerCase())) result[name] = value;
  }

  return result;
}

function prepareResponseHeaders(path, headers, options) {
  const result = cleanResponseHeaders(headers);
  if (!isConfigPath(path)) return result;

  const etagHeader = findHeaderName(result, "etag");
  if (!etagHeader) return result;

  const cached = parseConfigEtag(result[etagHeader]);
  const tagged = makeConfigEtag(cached?.original || result[etagHeader], options);
  if (tagged) result[etagHeader] = tagged;
  return result;
}

function processResponse(path, body, options) {
  if (path === "/browsita/v1/browse") {
    return removeBrowsitaBrandAds(body);
  }

  if (path === "/user-customization-service/v1/customize") {
    return mutateAtPath(body, [1], (value) => mutateCustomizationSuccess(value, options));
  }

  if (path === "/bootstrap/v1/bootstrap") {
    return mutateAtPath(body, [2, 1, 1, 1], (value) =>
      mutateCustomizationSuccess(value, options),
    );
  }

  return { bytes: body, changes: 0 };
}

function main() {
  try {
    const path = new URL($request.url).pathname;
    const options = parseArguments(typeof $argument === "undefined" ? undefined : $argument);

    if (typeof $response === "undefined") {
      return $done(processRequest(path, options));
    }

    const status = $response.status ?? $response.statusCode;
    if (status === 304 && isConfigPath(path)) {
      return $done({
        headers: prepareResponseHeaders(path, $response.headers, options),
      });
    }
    if (status !== 200) return $done({});

    const input = responseBodyBytes($response);
    const output = processResponse(path, input, options);

    if (output.changes === 0) return $done({});

    console.log(
      `[Spotify] ${path}: updated ${output.changes} values, ${input.length} -> ${output.bytes.length} bytes`,
    );

    return $done({
      body: output.bytes,
      headers: prepareResponseHeaders(path, $response.headers, options),
    });
  } catch (error) {
    console.log(`[Spotify] safe fallback: ${error.message}`);
    return $done({});
  }
}

main();
