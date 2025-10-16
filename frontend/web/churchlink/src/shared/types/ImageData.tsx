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
    files: ImageResponse[];
    folders: string[];
    total: number;
    page: number;
    page_size: number;
}

export interface FolderResponse {
    path: string;
    action: "create" | "rename" | "move" | "delete" | "delete_move_up";
    details?: Record<string, unknown>;
}
