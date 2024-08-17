import { SuiMoveNormalizedType } from '@mysten/sui/client';

export const getPlaceholder = (type: SuiMoveNormalizedType): string => {
  if (typeof type === 'string') {
    return type;
  }

  const temp = type as any;

  if (temp.TypeParameter) {
    return typeof temp.TypeParameter;
  }

  if (temp.Struct) {
    return `<package_id>::${temp.Struct.module}::${temp.Struct.name}`;
  }

  if (temp.Reference) {
    return getPlaceholder(temp.Reference);
  }

  if (temp.MutableReference) {
    return getPlaceholder(temp.MutableReference);
  }

  if (temp.Vector) {
    return `Vector<${getPlaceholder(temp.MutableReference)}>`;
  }

  return 'unknown type';
};
