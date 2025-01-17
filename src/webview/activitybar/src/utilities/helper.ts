import { SuiMoveNormalizedType } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { getObjectType } from './getObjectType';
import { IAccount } from '../recoil';

export const getInterfaceType = (
  paramType: SuiMoveNormalizedType,
): 'vector' | 'complex' | 'other' => {
  if (typeof paramType === 'object' && 'Vector' in paramType) {
    return 'vector';
  }
  if (typeof paramType === 'object' && 'Reference' in paramType) {
    return getInterfaceType(paramType.Reference);
  }
  if (typeof paramType === 'object' && 'MutableReference' in paramType) {
    return getInterfaceType(paramType.MutableReference);
  }
  if (typeof paramType === 'object' && 'Struct' in paramType) {
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
    return `T${paramType.TypeParameter}`;
  }

  if (typeof paramType === 'object' && 'Reference' in paramType) {
    return `${getTypeName(paramType.Reference)}`;
  }

  if (typeof paramType === 'object' && 'MutableReference' in paramType) {
    return `${getTypeName(paramType.MutableReference)}`;
  }

  return 'Unknown Type';
};

export const validateInput = async (
  account: IAccount,
  paramType: SuiMoveNormalizedType,
  value: string | string[],
): Promise<boolean> => {
  try {
    if (typeof value === 'string' && typeof paramType === 'string') {
      switch (paramType) {
        case 'U8':
        case 'U16':
        case 'U32':
        case 'U64':
        case 'U128':
        case 'U256':
          return /^\d+$/.test(value);
        case 'Bool':
          return /^(true|false)$/.test(value.toLowerCase());
        case 'Address':
          return /^0x[a-fA-F0-9]{64}$/.test(value);
        default:
          break;
      }
    } else if (typeof paramType === 'object' && 'Vector' in paramType && Array.isArray(value)) {
      let result = true;
      for (const item of value) {
        switch (paramType.Vector) {
          case 'U8':
          case 'U16':
          case 'U32':
          case 'U64':
          case 'U128':
          case 'U256':
            return /^0[xX][0-9a-fA-F]+$|^[0-9a-fA-F]+$/.test(item);
          case 'Bool':
            return /^(true|false)$/.test(item.toLowerCase());
          case 'Address':
            return /^0x[a-fA-F0-9]{64}$/.test(item);
          default:
            break;
        }
        result &&= await validateInput(account, paramType.Vector, item);
      }
      return result;
    } else if (!Array.isArray(value)) {
      if (typeof paramType === 'object' && 'Struct' in paramType) {
        const typeName = getTypeName(paramType);
        const objectType = await getObjectType(account, value);
        return typeName === objectType;
      }
      if (typeof paramType === 'object' && 'MutableReference' in paramType) {
        const objectType = await getObjectType(account, value);
        const result = await validateInput(account, paramType.MutableReference, objectType);
        return result;
      }
      if (typeof paramType === 'object' && 'Reference' in paramType) {
        const objectType = await getObjectType(account, value);
        const result = await validateInput(account, paramType.Reference, objectType);
        return result;
      }
      if (typeof paramType === 'object' && 'TypeParameter' in paramType) {
        // const n = paramType.TypeParameter;
      }
    }
    return false;
  } catch {
    return false;
  }
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
  paramType: SuiMoveNormalizedType,
  value: string | string[],
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
        return transaction.pure('u64', BigInt(value));
      case 'U128':
        return transaction.pure('u128', BigInt(value));
      case 'U256':
        return transaction.pure('u256', BigInt(value));
      case 'Bool':
        return transaction.pure('bool', value.toLowerCase() === 'true');
      case 'Address':
        return transaction.pure('address', value);
      default:
        break;
    }
  } else if (typeof paramType === 'object' && 'Vector' in paramType && Array.isArray(value)) {
    const results: (string | boolean)[] = [];
    let type: 'u8' | 'u16' | 'u32' | 'u64' | 'u128' | 'u256' | 'bool' | 'address' | undefined;
    for (const item of value) {
      switch (paramType.Vector) {
        case 'U8':
          type = 'u8';
          results.push(BigInt(`0x${item}`).toString());
          break;
        case 'U16':
          type = 'u16';
          results.push(BigInt(`0x${item}`).toString());
          break;
        case 'U32':
          type = 'u32';
          results.push(BigInt(`0x${item}`).toString());
          break;
        case 'U64':
          type = 'u64';
          results.push(BigInt(`0x${item}`).toString());
          break;
        case 'U128':
          type = 'u128';
          results.push(BigInt(`0x${item}`).toString());
          break;
        case 'U256':
          type = 'u256';
          results.push(BigInt(`0x${item}`).toString());
          break;
        case 'Bool':
          type = 'bool';
          results.push(item.toLowerCase() === 'true');
          break;
        case 'Address':
          type = 'address';
          results.push(item);
          break;
        default:
          break;
      }
    }
    return type ? transaction.pure.vector(type, results) : undefined;
  } else if (!Array.isArray(value)) {
    if (typeof paramType === 'object' && 'Struct' in paramType) {
      return transaction.object(value);
    }
    if (typeof paramType === 'object' && 'MutableReference' in paramType) {
      return makeParams(transaction, paramType.MutableReference, value);
    }
    if (typeof paramType === 'object' && 'Reference' in paramType) {
      return makeParams(transaction, paramType.Reference, value);
    }
    if (typeof paramType === 'object' && 'TypeParameter' in paramType) {
      // const n = paramType.TypeParameter;
    }
  }
  return;
};
