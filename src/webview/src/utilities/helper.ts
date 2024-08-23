import { SuiMoveNormalizedType } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

export const getInterfaceType = (
  paramType: SuiMoveNormalizedType,
): 'vector' | 'complex' | 'other' => {
  if (typeof paramType === 'object' && 'Vector' in paramType) {
    return 'vector';
  }
  if (
    typeof paramType === 'object' &&
    ('Struct' in paramType ||
      'Reference' in paramType ||
      'MutableReference' in paramType)
  ) {
    return 'complex';
  }
  return 'other';
};

export const getTypeName = (paramType: SuiMoveNormalizedType): string => {
  if (typeof paramType === 'string') {
    return paramType;
  }

  if (typeof paramType === 'object' && 'Struct' in paramType) {
    const struct = paramType.Struct;
    const typeArgs = struct.typeArguments
      .map((arg) => getTypeName(arg))
      .join(', ');
    return `${struct.address}::${struct.module}::${struct.name}${typeArgs && `<${typeArgs}>`}`;
  }

  if (typeof paramType === 'object' && 'Vector' in paramType) {
    return `Vector<${getTypeName(paramType.Vector)}>`;
  }

  if (typeof paramType === 'object' && 'TypeParameter' in paramType) {
    return `TypeParameter ${paramType.TypeParameter}`;
  }

  if (typeof paramType === 'object' && 'Reference' in paramType) {
    return `${getTypeName(paramType.Reference)}`;
  }

  if (typeof paramType === 'object' && 'MutableReference' in paramType) {
    return `${getTypeName(paramType.MutableReference)}`;
  }

  return 'Unknown Type';
};

export const getVecterType = (paramType: SuiMoveNormalizedType): string => {
  switch (paramType) {
    case 'U8':
    case 'U16':
    case 'U32':
    case 'U64':
    case 'U128':
    case 'U256':
    case 'Bool':
    case 'Address':
      return paramType.toLowerCase();
    default:
      break;
  }
  return '';
};

export const makeParams = (
  transaction: Transaction,
  value: string | string[],
  paramType: SuiMoveNormalizedType,
): any => {
  if (typeof paramType === 'string' && typeof value === 'string') {
    switch (paramType) {
      case 'U8':
        return transaction.pure('u8', parseInt(value));
      case 'U16':
        return transaction.pure('u16', parseInt(value));
      case 'U32':
        return transaction.pure('u32', parseInt(value));
      case 'U64':
        return transaction.pure('u64', parseInt(value));
      case 'U128':
        return transaction.pure('u128', parseInt(value));
      case 'U256':
        return transaction.pure('u256', parseInt(value));
      case 'Bool':
        return transaction.pure('bool', value.toLowerCase() === 'true');
      case 'Address':
        return transaction.pure('address', value);
      default:
        break;
    }
  }

  if (typeof paramType === 'object' && 'Vector' in paramType) {
    if (typeof value !== 'string') {
      const temp = getVecterType(paramType.Vector);
      return transaction.makeMoveVec(
        temp
          ? {
              type: temp,
              elements: value.map((item) =>
                makeParams(transaction, item, paramType.Vector),
              ),
            }
          : {
              elements: value.map((item) =>
                makeParams(transaction, item, paramType.Vector),
              ),
            },
      );
    }
  } else if (
    typeof paramType === 'object' &&
    ('Struct' in paramType ||
      'MutableReference' in paramType ||
      'Reference' in paramType) &&
    typeof value === 'string'
  ) {
    return transaction.object(value);
  } else if (typeof paramType === 'object' && 'TypeParameter' in paramType) {
    // TODO
  }
  return;
};
