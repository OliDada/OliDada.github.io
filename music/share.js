// Songs packed into a URL-safe string, for share links (#s=… in the Studio, ?music=… in games).

const b64url = (bytes) => {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function streamBytes(bytes, stream) {
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function encodeShare(json) {
    const bytes = new TextEncoder().encode(json);
    if ("CompressionStream" in window) return "z" + b64url(await streamBytes(bytes, new CompressionStream("deflate-raw")));
    return "j" + b64url(bytes);
}

export async function decodeShare(code) {
    const bytes = fromB64url(code.slice(1));
    const raw = code[0] === "z" ? await streamBytes(bytes, new DecompressionStream("deflate-raw")) : bytes;
    return new TextDecoder().decode(raw);
}
