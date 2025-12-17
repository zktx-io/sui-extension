import type { SuiClient, SuiObjectResponse } from '@mysten/sui/client';

const extractId = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.objectId === 'string') {
    return record.objectId;
  }
  if (typeof record.id === 'string') {
    return record.id;
  }

  const fields = record.fields as Record<string, unknown> | undefined;
  if (fields) {
    if (typeof fields.id === 'string') {
      return fields.id;
    }
    const nestedId = extractId(fields.id);
    if (nestedId) {
      return nestedId;
    }
  }

  return undefined;
};

export const extractPackageIdFromUpgradeCap = (
  response: SuiObjectResponse,
): string | undefined => {
  const content = response.data?.content as
    | { dataType?: string; fields?: Record<string, unknown> }
    | undefined;
  if (!content || content.dataType !== 'moveObject') {
    return undefined;
  }
  return extractId(content.fields?.package);
};

export const findOwnedUpgradeCap = async (
  client: SuiClient,
  owner: string,
  packageId: string,
): Promise<{ upgradeCapId: string; packageId: string } | null> => {
  let cursor: string | null | undefined = null;
  do {
    const res = await client.getOwnedObjects({
      owner,
      filter: { StructType: '0x2::package::UpgradeCap' },
      options: { showContent: true },
      cursor,
    });

    for (const item of res.data) {
      const objectId = item.data?.objectId;
      if (!objectId) {
        continue;
      }
      const capPackageId = extractPackageIdFromUpgradeCap(item);
      if (capPackageId === packageId) {
        return { upgradeCapId: objectId, packageId: capPackageId };
      }
    }

    cursor = res.hasNextPage ? res.nextCursor : null;
  } while (cursor);

  return null;
};

export const getUpgradeCapPackageId = async (
  client: SuiClient,
  upgradeCapId: string,
): Promise<string | undefined> => {
  const res = await client.getObject({
    id: upgradeCapId,
    options: { showContent: true },
  });
  return extractPackageIdFromUpgradeCap(res);
};
