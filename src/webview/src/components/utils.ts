import { SuiMoveNormalizedType } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

export const isComplexType = (paramType: SuiMoveNormalizedType) => {
  return (
    typeof paramType === 'object' &&
    ('Struct' in paramType ||
      'Vector' in paramType ||
      'Reference' in paramType ||
      'MutableReference' in paramType)
  );
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

export const validateInput = (
  value: string,
  paramType: SuiMoveNormalizedType,
): boolean => {
  if (typeof paramType === 'string') {
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
        return true;
    }
  }

  if (typeof paramType === 'object' && 'Struct' in paramType) {
    return (
      value.includes(paramType.Struct.module) &&
      value.includes(paramType.Struct.name)
    );
  } else if (typeof paramType === 'object' && 'Vector' in paramType) {
    const elements = value.split(',').map((el) => el.trim());
    return elements.every((el) => validateInput(el, paramType.Vector));
  } else if (
    typeof paramType === 'object' &&
    ('Reference' in paramType || 'MutableReference' in paramType)
  ) {
    const referencedType =
      'Reference' in paramType
        ? paramType.Reference
        : paramType.MutableReference;
    return validateInput(value, referencedType);
  } else if (typeof paramType === 'object' && 'TypeParameter' in paramType) {
    return /^\d+$/.test(value);
  }

  return false;
};

export const makeParams = (
  transaction: Transaction,
  value: string,
  paramType: SuiMoveNormalizedType,
): any => {
  if (typeof paramType === 'string') {
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

  if (typeof paramType === 'object' && 'Struct' in paramType) {
    // TODO
  } else if (typeof paramType === 'object' && 'Vector' in paramType) {
    // TODO
  } else if (typeof paramType === 'object' && 'Reference' in paramType) {
    // TODO
  } else if (typeof paramType === 'object' && 'MutableReference' in paramType) {
    return transaction.object(value);
  } else if (typeof paramType === 'object' && 'TypeParameter' in paramType) {
    // TODO
  }
  throw new Error(`${paramType} is unknown type`);
};
