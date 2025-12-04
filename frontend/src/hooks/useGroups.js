import { useGroupsContext } from '@/contexts/GroupsContext'

// This hook is now a simple wrapper around the GroupsContext
// All components using this hook will share the same groups data
// This prevents duplicate API calls when multiple components use groups
export const useGroups = () => {
  return useGroupsContext()
}

export default useGroups
