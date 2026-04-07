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

  // Workers always self-assign
  if (!isAdmin) {
    return [currentUserId];
  }

  // Admin: respect their selection (including empty = unassigned)
  return assignedTo;
}
