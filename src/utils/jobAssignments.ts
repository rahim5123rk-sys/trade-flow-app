interface ResolveAssignedWorkerIdsParams {
  assignedTo: string[];
  currentUserId?: string | null;
  isAdmin: boolean;
}

export function resolveAssignedWorkerIds({
  assignedTo,
  currentUserId,
  isAdmin,
}: ResolveAssignedWorkerIdsParams): string[] {
  if (!currentUserId) {
    return isAdmin ? assignedTo : [];
  }

  if (!isAdmin) {
    return [currentUserId];
  }

  if (assignedTo.length > 0) {
    return assignedTo;
  }

  return [currentUserId];
}
