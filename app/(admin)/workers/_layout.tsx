import { Stack } from 'expo-router';

export default function WorkersLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Team Members' }} />
      <Stack.Screen name="add" options={{ title: 'Add Worker', presentation: 'modal' }} />
    </Stack>
  );
}