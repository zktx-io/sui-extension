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

const validateVectors = (input: string, type: string): boolean => {
  try {
    const parsed = JSON.parse(input);

    if (!Array.isArray(parsed)) {
      return false;
    }

    const validateVector = (
      data: any,
      type: string,
      depth: number,
    ): boolean => {
      const vectorMatch = type.match(/^Vector<(.+)>$/);
      if (vectorMatch) {
        const innerType = vectorMatch[1];
        if (!Array.isArray(data)) {
          return false;
        }
        return data.every((item) => validateVector(item, innerType, depth + 1));
      } else {
        if (type === 'U8') {
          return typeof data === 'number' && data >= 0 && data <= 255;
        }
        if (type === 'U16') {
          return typeof data === 'number' && data >= 0 && data <= 65535;
        }
        if (type === 'U32') {
          return typeof data === 'number' && data >= 0 && data <= 4294967295;
        }
        if (type === 'U64' || type === 'U128' || type === 'U256') {
          return typeof data === 'string' && /^[0-9]+$/.test(data);
        }
        if (type === 'Address') {
          return /^0x[a-fA-F0-9]{64}$/.test(data);
        }
        if (type === 'Bool') {
          return typeof data === 'boolean';
        }
        return false;
      }
    };
    return validateVector(parsed, type, 0);
  } catch {
    return false;
  }
};

export const validateInput = async (
  account: IAccount,
  paramType: SuiMoveNormalizedType,
  value: string,
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
    } else if (typeof paramType === 'object' && 'Vector' in paramType) {
      return validateVectors(value, getTypeName(paramType));
    } else if (
      typeof paramType === 'object' &&
      ('Struct' in paramType ||
        'MutableReference' in paramType ||
        'Reference' in paramType) &&
      typeof value === 'string'
    ) {
      const typeName = getTypeName(paramType);
      const objectType = await getObjectType(account, value);
      return typeName === objectType;
    } else if (typeof paramType === 'object' && 'TypeParameter' in paramType) {
      // TODO
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

const processAndConvertVectors = (data: any, paramType: string): any => {
  const vectorMatch = paramType.match(/^Vector<(.+)>$/);
  if (vectorMatch) {
    const innerType = vectorMatch[1];
    if (!Array.isArray(data)) {
      throw new Error(`Invalid data: expected array for ${paramType}`);
    }
    return data.map((item) => processAndConvertVectors(item, innerType));
  } else {
    switch (paramType) {
      case 'U8':
      case 'U16':
      case 'U32':
        return parseInt(data);
      case 'U64':
      case 'U128':
      case 'U256':
        return BigInt(data);
      case 'Bool':
      case 'Address':
        return data;
      default:
        throw new Error(`Unsupported type: ${paramType}`);
    }
  }
};

export const makeParams = (
  transaction: Transaction,
  paramType: SuiMoveNormalizedType,
  value: string,
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
  } else if (typeof paramType === 'object' && 'Vector' in paramType) {
    return transaction.pure(
      getTypeName(paramType).toLowerCase() as any,
      processAndConvertVectors(JSON.parse(value), getTypeName(paramType)),
    );
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
