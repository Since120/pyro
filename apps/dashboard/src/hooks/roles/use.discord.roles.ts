// apps/dashboard/src/hooks/roles/use.discord.roles.ts
import { useQuery } from '@apollo/client';
import { GetDiscordRolesDocument } from '../../graphql/generated/graphql';

export const useDiscordRoles = () => {
  return useQuery(GetDiscordRolesDocument);
};