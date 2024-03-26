import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../../api";
import { Buffer } from "buffer";
import { isAxiosError } from "axios";
import { enqueueSnackbar } from "notistack";
import { useHealthCheck } from "./HealthcheckProvider";

async function decodeBase64Data(base64Data: string) {
  const byteCharacters = Buffer.from(base64Data, "base64").toString("binary");
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = Uint8Array.from(byteNumbers);
  const blob = new Blob([byteArray]);
  const url = URL.createObjectURL(blob);
  return url;
}

type UserInfo = {
  name: string | null;
  openaiApiKey: string | null;
  avatarUrl: string | null;
};

type UserInfoContextType = [
  UserInfo | null,
  React.Dispatch<React.SetStateAction<UserInfo>>,
  (blob: string) => Promise<void>
];

const UserInfoContext = createContext<UserInfoContextType>([
  null,
  () => {},
  async () => {},
]);

// Custom hook that returns the user info and a function to set the avatar blob
export const useUserInfo = () => {
  const context = useContext(UserInfoContext);
  if (context === undefined) {
    throw new Error("useUserInfo must be used within a UserInfoProvider");
  }
  return context;
};

export const UserInfoProvider = ({ children }: React.PropsWithChildren) => {
  const [isHealthy] = useHealthCheck();
  const [userInfo, setUserInfo] = useState<UserInfo>({
    name: null,
    openaiApiKey: null,
    avatarUrl: null,
  });

  async function setAvatarBlob(blob: string) {
    const url = await decodeBase64Data(blob);
    setUserInfo({
      ...userInfo,
      avatarUrl: url,
    });
  }

  async function getAvatarUrl(): Promise<string | null> {
    try {
      const response = await api.getAvatar();
      return await decodeBase64Data(response.data.blob);
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.response?.status !== 404) {
          enqueueSnackbar({
            variant: "error",
            message: error.response?.data.detail,
          });
        }
        return null;
      }
      return null;
    }
  }

  async function getUserInfo() {
    try {
      const response = await api.getUserInfo();
      const avatarUrl = await getAvatarUrl();
      const name = response.data.name;
      const openaiApiKey = response.data.openai_api_key;

      setUserInfo({
        name: name,
        openaiApiKey: openaiApiKey,
        avatarUrl: avatarUrl !== null ? avatarUrl : userInfo.avatarUrl,
      });
    } catch {
      enqueueSnackbar({ variant: "error", message: "Error getting user info" });
    }
  }

  useEffect(() => {
    if (isHealthy) {
      getUserInfo();
    }
  }, [isHealthy]);

  return (
    <UserInfoContext.Provider value={[userInfo, setUserInfo, setAvatarBlob]}>
      {children}
    </UserInfoContext.Provider>
  );
};
