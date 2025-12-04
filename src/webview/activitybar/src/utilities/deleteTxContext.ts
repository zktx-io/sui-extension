import {
  SuiMoveNormalizedFunction,
  SuiMoveNormalizedType,
} from '@mysten/sui/client';

type StructType = Extract<SuiMoveNormalizedType, { Struct: unknown }>['Struct'];

const extractStruct = (
  type: SuiMoveNormalizedType,
): StructType | undefined => {
  if (typeof type !== 'object' || type === null) {
    return undefined;
  }
  if ('Struct' in type) {
    return type.Struct;
  }
  if ('MutableReference' in type) {
    return extractStruct(type.MutableReference);
  }
  if ('Reference' in type) {
    return extractStruct(type.Reference);
  }
  return undefined;
};

const isTxContextStruct = (struct: StructType | undefined): boolean => {
  return (
    !!struct &&
    struct.address === '0x2' &&
    struct.module === 'tx_context' &&
    struct.name === 'TxContext'
  );
};

export const deleteTxContext = (
  func: SuiMoveNormalizedFunction,
): SuiMoveNormalizedType[] => {
  return func.parameters.filter((type) => {
    if (typeof type !== 'object') {
      return true;
    }
    const struct = extractStruct(type);
    return !isTxContextStruct(struct);
  });
};
