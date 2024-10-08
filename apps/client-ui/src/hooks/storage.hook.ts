import StorageApi, {
  CreateFolderDTO,
  ItemLabel,
  Pagination,
} from "@api/storage.api";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export const useStorage = () => {
  return useQuery({
    queryKey: ["storage"],
    queryFn: StorageApi.myStorage,
  });
};

export const useFolderInfinite = (refId?: string, label?: ItemLabel) => {
  return useInfiniteQuery({
    queryKey: ["folder", refId, label, "infinite"],
    queryFn: ({ pageParam }: { pageParam: Pagination }) => {
      return StorageApi.getFolder({ id: refId, label, pagination: pageParam });
    },
    initialPageParam: { folderCursor: undefined, fileCursor: undefined },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
};

export const useFolder = (refId?: string, label?: ItemLabel) => {
  const storage = useStorage();
  return useQuery({
    queryKey: ["folder", refId, label],
    queryFn: () => StorageApi.getFolder({ id: refId, label }),
    enabled: !refId ? storage.isSuccess : true,
  });
};

export const useCreateFolder = (refId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["createFolder"],
    throwOnError: false,
    mutationFn(dto: CreateFolderDTO) {
      return StorageApi.createFolder({ ...dto, parentId: refId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folder", refId] });
    },
  });
};

export const useUploadFile = (refId?: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: ["uploadFile"],
    throwOnError: (err) => {
      if (err instanceof Error && err.name === "CanceledError") return false;
      return true;
    },
    mutationFn(req: {
      file: File;
      onProgress?: (progress: number) => void;
      signal?: AbortSignal;
    }) {
      return StorageApi.uploadFile(
        { file: req.file, parentId: refId },
        {
          signal: req.signal,
          onUploadProgress(event) {
            const progress = event.progress;
            if (!progress) return req.onProgress?.(0);
            req.onProgress?.(Math.ceil(progress * 100));
          },
        }
      );
    },
    onMutate: (values) => values.onProgress?.(0),
    onSuccess: (_data, values) => {
      values.onProgress?.(100);
      queryClient.refetchQueries({ queryKey: ["folder", refId] });
      queryClient.refetchQueries({ queryKey: ["storage"] });
    },
  });
  return mutation;
};

export const useUploadFiles = (refId?: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: ["uploadFiles", refId],
    throwOnError: (err) => {
      if (err instanceof Error && err.name === "CanceledError") return false;
      return true;
    },
    mutationFn(req: {
      files: File[];
      onProgress?: (progress: number) => void;
      signal?: AbortSignal;
    }) {
      return StorageApi.uploadFiles(
        { files: req.files, parentId: refId },
        {
          signal: req.signal,
          onUploadProgress(event) {
            const progress = event.progress;
            if (!progress) return req.onProgress?.(0);
            req.onProgress?.(Math.ceil(progress * 100));
          },
        }
      );
    },
    onMutate: (values) => values.onProgress?.(0),
    onSuccess: (_data, values) => {
      values.onProgress?.(100);
      queryClient.refetchQueries({ queryKey: ["folder", refId] });
      queryClient.refetchQueries({ queryKey: ["storage"] });
    },
  });
  return mutation;
};

export const useUploadFolder = (refId?: string) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: ["uploadFolder", refId],
    throwOnError: (err) => {
      if (err instanceof Error && err.name === "CanceledError") return false;
      return true;
    },
    mutationFn(req: {
      files: File[];
      onProgress?: (progress: number) => void;
      signal?: AbortSignal;
    }) {
      return StorageApi.uploadFolder(
        { files: req.files, parentId: refId },
        {
          signal: req.signal,
          onUploadProgress(event) {
            const progress = event.progress;
            if (!progress) return req.onProgress?.(0);
            req.onProgress?.(Math.ceil(progress * 100));
          },
        }
      );
    },
    onMutate: (values) => values.onProgress?.(0),
    onSuccess: (_data, values) => {
      values.onProgress?.(100);
      queryClient.refetchQueries({ queryKey: ["folder", refId] });
      queryClient.refetchQueries({ queryKey: ["storage"] });
    },
  });
  return mutation;
};

export const useUpdateFile = (refId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["updateFile"],
    throwOnError: false,
    mutationFn: StorageApi.updateFile,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["folder", refId] });
    },
  });
};

export const useUpdateFolder = (refId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["updateFolder", refId],
    throwOnError: false,
    mutationFn: StorageApi.updateFolder,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["folder", refId] });
    },
  });
};

export const useHardDelete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["hardDelete"],
    throwOnError: false,
    mutationFn: StorageApi.hardDelete,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["folder"] });
      queryClient.refetchQueries({ queryKey: ["storage"] });
    },
  });
};

export const useDownloadFile = () => {
  return useMutation({
    mutationKey: ["downloadFile"],
    throwOnError: false,
    mutationFn: (req: {
      id: string;
      name: string;
      signal?: AbortSignal;
      onProgress?: (progress: number) => void;
    }) => {
      return StorageApi.downloadFile(req, {
        signal: req.signal,
        onDownloadProgress(event) {
          const progress = event.progress;
          if (!progress) return req.onProgress?.(0);
          req.onProgress?.(Math.ceil(progress * 100));
        },
      });
    },
    onMutate: (values) => values.onProgress?.(0),
    onSuccess: (_data, values) => {
      values.onProgress?.(100);
    },
  });
};

export const useDownloadFolder = () => {
  return useMutation({
    mutationKey: ["downloadFolder"],
    throwOnError: (err) => {
      if (err instanceof Error && err.name === "CanceledError") return false;
      return true;
    },
    mutationFn: (req: {
      id: string;
      signal?: AbortSignal;
      onProgress?: (progress: number) => void;
    }) => {
      return StorageApi.downloadFolder(req, {
        signal: req.signal,
        onDownloadProgress(event) {
          const progress = event.progress;
          if (!progress) return req.onProgress?.(0);
          req.onProgress?.(Math.ceil(progress * 100));
        },
      });
    },
    onMutate: (values) => values.onProgress?.(0),
    onSuccess: (_data, values) => values.onProgress?.(100),
  });
};

export const useDownloadThumbnail = () => {
  return useMutation({
    mutationKey: ["downloadThumbnail"],
    throwOnError: false,
    mutationFn: StorageApi.downloadThumbnail,
  });
};
