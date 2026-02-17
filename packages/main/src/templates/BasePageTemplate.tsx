import StackLayout from '@swiftpost/elysium/layouts/StackLayout';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import { staticTheme } from '@/styles/staticTheme';
import ContentFittedStack from '@swiftpost/elysium/ui/ContentFittedStack';

const contentMaxWidth = staticTheme.breakpoints.values.lg;

interface Props {
  children: React.ReactNode;
}

const BasePageTemplate: React.FC<Props> = ({ children }) => {
  return (
    <StackLayout
      slotProps={{
        mainContainer: {
          children: (
            <Stack>
              <ContentFittedStack
                component="main"
                id="main"
                marginX={staticTheme.spacing(2)}
                contentMaxWidth={contentMaxWidth}
              >
                {children}
              </ContentFittedStack>
            </Stack>
          ),
        },
      }}
    />
  );
};

export default BasePageTemplate;
