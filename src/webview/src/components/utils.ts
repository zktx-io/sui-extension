import { SuiMoveNormalizedType } from '@mysten/sui/client';

const shortenAddress = (address: string): string => {
  return `${address.slice(0, 6)}...`;
};

export const isComplexType = (type: SuiMoveNormalizedType) => {
  return (
    typeof type === 'object' &&
    ('Struct' in type ||
      'Vector' in type ||
      'Reference' in type ||
      'MutableReference' in type)
  );
};

export const getTypeName = (
  selfAddress: string,
  type: SuiMoveNormalizedType,
): string => {
  if (typeof type === 'string') {
    return type;
  }

  if ('Struct' in type) {
    const struct = type.Struct;
    const addressPart =
      struct.address === selfAddress
        ? '0xSelf'
        : shortenAddress(struct.address);
    const typeArgs = struct.typeArguments
      .map((arg) => getTypeName(selfAddress, arg))
      .join(', ');
    return `Struct ${addressPart}::${struct.module}::${struct.name}<${typeArgs}>`;
  }

  if ('Vector' in type) {
    return `Vector<${getTypeName(selfAddress, type.Vector)}>`;
  }

  if ('TypeParameter' in type) {
    return `TypeParameter ${type.TypeParameter}`;
  }

  if ('Reference' in type) {
    return `Reference<${getTypeName(selfAddress, type.Reference)}>`;
  }

  if ('MutableReference' in type) {
    return `MutableReference<${getTypeName(selfAddress, type.MutableReference)}>`;
  }

  return 'Unknown Type';
};

export const validateInput = (
  value: string,
  expectedType: SuiMoveNormalizedType,
): boolean => {
  // 먼저 expectedType이 기본 타입인지 확인
  if (typeof expectedType === 'string') {
    switch (expectedType) {
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

  if ('Struct' in expectedType) {
    return (
      value.includes(expectedType.Struct.module) &&
      value.includes(expectedType.Struct.name)
    );
  } else if ('Vector' in expectedType) {
    const elements = value.split(',').map((el) => el.trim());
    return elements.every((el) => validateInput(el, expectedType.Vector));
  } else if (
    'Reference' in expectedType ||
    'MutableReference' in expectedType
  ) {
    const referencedType =
      'Reference' in expectedType
        ? expectedType.Reference
        : expectedType.MutableReference;
    return validateInput(value, referencedType);
  } else if ('TypeParameter' in expectedType) {
    return /^\d+$/.test(value);
  }

  return false;
};
