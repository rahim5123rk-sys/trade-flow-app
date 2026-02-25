import { Stack } from 'expo-router';

export default function JobsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'All Jobs' }} />
      <Stack.Screen name="create" options={{ title: 'New Job', presentation: 'modal' }} />
    </Stack>
  );
}