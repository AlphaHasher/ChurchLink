export interface ImageResponse {
    id: string;
    name: string;
    extension: string;
    description?: string | null;
    folder: string;
    path: string;
    public_url: string;
    thumb_url: string;
}

export interface ListImagesResponse {
    items: ImageResponse[];
}

export interface FolderResponse {
    path: string;
    action: "create" | "rename" | "move" | "delete" | "lift_children_and_remove";
    details?: Record<string, unknown>;
}