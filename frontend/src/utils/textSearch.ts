export const normalizarBusqueda = (texto: string | null | undefined) =>
    (texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

export const coincideBusqueda = (texto: string | null | undefined, busqueda: string | null | undefined) =>
    normalizarBusqueda(texto).includes(normalizarBusqueda(busqueda));
