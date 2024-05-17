import React, { Component } from 'react';
import { View, Text, FlatList, TouchableHighlight, TouchableOpacity, Linking, StyleSheet, Image, Button, ActivityIndicator, Alert } from 'react-native';
import { ProgressBar } from '@react-native-community/progress-bar-android';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { NavigationContainer } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import OpenFile from 'react-native-open-file';

const Tab = createMaterialTopTabNavigator();

class App extends Component {
  constructor() {
    super();
    this.state = {
      versions: [],
      isLoading: false,
      isManagePermitted: false,
      downloading: false,
      downloadProgress: 0,
      downloadComplete: false,
      downloadedFilePath: '',
      downloadErrorMessage: '',
      downloadSuccessMessage: '',
      showDeleteButton: true,
    };
  }

  componentDidMount() {
    this.checkManagePermission();
    this.fetchData();
  }

  checkManagePermission = async () => {
    try {
      const isManagePermitted = await checkManagePermission();
      this.setState({ isManagePermitted });
    } catch (error) {
      console.error('Error checking manage permission:', error);
    }
  };

  requestManageStoragePermission = async () => {
    try {
      const isManagePermitted = await requestManagePermission();
      this.setState({ isManagePermitted });
    } catch (error) {
      console.error('Error requesting manage storage permission:', error);
    }
  };

  fetchData = async () => {
    this.setState({ isLoading: true });

    const githubUrl = 'https://raw.githubusercontent.com/MrPurple666/minecraft/main/mine.json';

    try {
      const response = await fetch(githubUrl);
      if (!response.ok) {
        throw new Error('HTTP request error');
      }
      const data = await response.json();
      const versions = data.versions.map((version) => ({
        ...version,
        versao: version.versao.split('.').map(Number),
      }));
      versions.sort((a, b) => {
        for (let i = 0; i < Math.min(a.versao.length, b.versao.length); i++) {
          if (a.versao[i] !== b.versao[i]) {
            return b.versao[i] - a.versao[i];
          }
        }
        return b.versao.length - a.versao.length;
      });
      this.setState({ versions });
    } catch (error) {
      console.error('Error fetching data from GitHub:', error);
    } finally {
      this.setState({ isLoading: false });
    }
  };

  downloadApk = (link, nome) => {
    const apkLink = link;
    const nomeArquivo = nome || link.substring(link.lastIndexOf('/') + 1);
    const downloadDest = `${RNFS.ExternalStorageDirectoryPath}/mclauncher/${nomeArquivo}.apk`;

    RNFS.mkdir(`${RNFS.ExternalStorageDirectoryPath}/mclauncher`, {
      NSURLIsExcludedFromBackupKey: true,
    })
      .then(() => {
        this.setState({ downloading: true, downloadProgress: 0 });
        return RNFS.downloadFile({
          fromUrl: apkLink,
          toFile: downloadDest,
          progress: (res) => {
            const progress = res.bytesWritten / res.contentLength;
            this.setState({ downloadProgress: progress });
          },
          progressDivider: 10,
        }).promise;
      })
      .then((res) => {
        if (res.statusCode === 200) {
          this.setState({
            downloadComplete: true,
            downloadedFilePath: downloadDest,
            downloadSuccessMessage: 'Download completed, please install the APK from the mclauncher folder in your internal storage.',
            showDeleteButton: true,
            downloadErrorMessage: '',
          });
          this.promptInstall(downloadDest);
        } else {
          this.setState({
            downloadErrorMessage: 'Error downloading the APK file',
            downloadSuccessMessage: '',
          });
        }
      })
      .catch((error) => {
        console.error('Error downloading APK:', error);
        this.setState({
          downloadErrorMessage: 'Error downloading APK',
          downloadSuccessMessage: '',
        });
      })
      .finally(() => {
        this.setState({ downloading: false });
      });
  };

  promptInstall = (filePath) => {
    Alert.alert(
      'Download Complete',
      'Do you want to install the APK now?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Install',
          onPress: () => OpenFile.openDoc([{ url: `file://${filePath}`, fileName: 'Minecraft APK', fileType: 'application/vnd.android.package-archive' }], (error) => {
            if (error) {
              console.error('Error opening APK file:', error);
            }
          }),
        },
      ],
      { cancelable: false }
    );
  };

  openLink = (link, nome) => {
    const nomeArquivo = nome || link.substring(link.lastIndexOf('/') + 1);
    const filePath = `${RNFS.ExternalStorageDirectoryPath}/mclauncher/${nomeArquivo}.apk`;

    RNFS.exists(filePath)
      .then((exists) => {
        if (exists) {
          this.promptInstall(filePath);
        } else {
          this.downloadApk(link, nome);
        }
      })
      .catch((error) => {
        console.error('Error checking APK file existence:', error);
      });
  };

  deleteAllFiles = () => {
    const mclauncherFolderPath = `${RNFS.ExternalStorageDirectoryPath}/mclauncher`;

    RNFS.readDir(mclauncherFolderPath)
      .then((result) => {
        const deletePromises = result.map((file) => RNFS.unlink(file.path));
        return Promise.all(deletePromises);
      })
      .then(() => {
        console.log('All files deleted.');
        this.setState({
          showDeleteButton: false,
          downloadSuccessMessage: '',
        });
      })
      .catch((error) => {
        console.error('Error deleting files:', error);
      });
  };

  renderVersionItem = ({ item }) => {
    return (
      <TouchableHighlight
        onPress={() => this.openLink(item.link, item.nome)}
        style={styles.versionItem}
        underlayColor="#000000"
      >
        <Text style={styles.versionText}>{item.nome}</Text>
      </TouchableHighlight>
    );
  };

  render() {
    return (
      <View style={styles.container}>
        {!this.state.isManagePermitted && (
          <Button
            title="Request Storage Permission"
            onPress={this.requestManageStoragePermission}
            disabled={this.state.isLoading}
            color="#1a620b"
          />
        )}
        <View style={styles.messageContainer}>
          {this.state.downloadErrorMessage !== '' && (
            <Text style={styles.errorMessage}>{this.state.downloadErrorMessage}</Text>
          )}
          {this.state.downloadSuccessMessage !== '' && (
            <Text style={styles.successMessage}>{this.state.downloadSuccessMessage}</Text>
          )}
        </View>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image source={require('./android/app/src/main/res/mipmap-xxxhdpi/title.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Game Versions:</Text>
          </View>
          <Button
            title="Delete Files"
            onPress={this.deleteAllFiles}
            disabled={!this.state.showDeleteButton}
            color="red"
          />
          <Button
            title="Reload"
            onPress={this.fetchData}
            disabled={this.state.isLoading}
            color="#1a620b"
          />
        </View>
        {this.state.isLoading ? (
          <ActivityIndicator size="large" color="white" />
        ) : (
          <NavigationContainer>
            <Tab.Navigator
              screenOptions={{
                tabBarActiveTintColor: 'white',
                tabBarInactiveTintColor: 'gray',
                tabBarLabelStyle: { fontSize: 16 },
                tabBarStyle: { backgroundColor: '#000000' },
              }}
            >
              <Tab.Screen name="Stable">
                {() => <StableScreen versions={this.state.versions} openLink={this.openLink} />}
              </Tab.Screen>
              <Tab.Screen name="Beta">
                {() => <BetaScreen versions={this.state.versions} openLink={this.openLink} />}
              </Tab.Screen>
              <Tab.Screen name="Legacy">
                {() => <LegacyScreen versions={this.state.versions} openLink={this.openLink} />}
              </Tab.Screen>
              <Tab.Screen name="About">
                {() => <AboutScreen />}
              </Tab.Screen>
            </Tab.Navigator>
          </NavigationContainer>
        )}
        {this.state.downloading && (
          <View style={styles.modalContainer}>
            <Text style={styles.modalText}>Downloading...</Text>
            <ProgressBar
              styleAttr="Horizontal"
              color="#1a620b"
              indeterminate={false}
              progress={this.state.downloadProgress}
              style={{ width: '80%' }}
            />
          </View>
        )}
      </View>
    );
  }
}

function StableScreen({ versions, openLink }) {
  const stableVersions = versions.filter((version) => version.tipo === 'Stable');

  return (
<View style={styles.screenContainer}>
      <FlatList
        data={stableVersions}
        keyExtractor={(item) => item.versao.join('.')}
        renderItem={({ item }) => (
          <TouchableHighlight
            onPress={() => openLink(item.link, item.nome)}
            style={styles.versionItem}
            underlayColor="#000000"
          >
            <Text style={styles.versionText}>{item.nome}</Text>
          </TouchableHighlight>
        )}
      />
    </View>
  );
}

function BetaScreen({ versions, openLink }) {
  const betaVersions = versions.filter((version) => version.tipo === 'Beta');

  return (
    <View style={styles.screenContainer}>
      <FlatList
        data={betaVersions}
        keyExtractor={(item) => item.versao.join('.')}
        renderItem={({ item }) => (
          <TouchableHighlight
            onPress={() => openLink(item.link, item.nome)}
            style={styles.versionItem}
            underlayColor="#000000"
          >
            <Text style={styles.versionText}>{item.nome}</Text>
          </TouchableHighlight>
        )}
      />
    </View>
  );
}

function LegacyScreen({ versions, openLink }) {
  const legacyVersions = versions.filter((version) => version.tipo === 'Legacy');

  return (
    <View style={styles.screenContainer}>
      <FlatList
        data={legacyVersions}
        keyExtractor={(item) => item.versao.join('.')}
        renderItem={({ item }) => (
          <TouchableHighlight
            onPress={() => openLink(item.link, item.nome)}
            style={styles.versionItem}
            underlayColor="#000000"
          >
            <Text style={styles.versionText}>{item.nome}</Text>
          </TouchableHighlight>
        )}
      />
    </View>
  );
}

function AboutScreen() {
  const telegramUsername = 'Mr_Purple_666';

  const openTelegram = () => {
    Linking.openURL(`https://t.me/${telegramUsername}`);
  };

  return (
    <View style={styles.aboutContainer}>
      <Text style={styles.aboutText}>
        Este app tem a função de baixar o Minecraft Bedrock (Android), onde você não precisará passar por encurtadores de links e afins. Fique à vontade para entrar em contato conosco no Telegram se tiver alguma dúvida.
      </Text>
      <TouchableOpacity onPress={openTelegram}>
        <Text style={styles.telegramLink}>{telegramUsername}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  logoContainer: {
    flex: 0,
    alignItems: 'center',
  },
  titleContainer: {
    flex: 0,
    alignItems: 'flex-start',
  },
  header: {
    flexDirection: 'column',
  },
  logo: {
    width: 256,
    height: 128,
    alignItems: 'center',
  },
  reloadButton: {
    borderRadius: 70,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: 'red',
    marginBottom: 10,
  },
  successMessage: {
    fontSize: 16,
    color: 'green',
    marginBottom: 10,
  },
  aboutContainer: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 16,
  },
  aboutText: {
    fontSize: 18,
    color: 'green',
    marginBottom: 20,
  },
  telegramLink: {
    fontSize: 18,
    color: '#c912e2',
    textDecorationLine: 'underline',
  },
  title: {
    fontSize: 24,
    marginTop: 0,
    marginBottom: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  versionItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  versionText: {
    color: 'green',
    fontSize: 18,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalText: {
    fontSize: 24,
    color: 'white',
    marginBottom: 20,
  },
  messageContainer: {
    marginBottom: 20,
  },
});

export default App;
