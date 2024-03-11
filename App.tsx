import React, { Component } from 'react';
import { View, Text, FlatList, TouchableHighlight, TouchableOpacity, Linking, StyleSheet, Image, Button, ActivityIndicator, ProgressCircle } from 'react-native';
import { ProgressBar } from '@react-native-community/progress-bar-android'; // Consider using ProgressCircle for a more modern look
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { requestManagePermission, checkManagePermission } from 'manage-external-storage';
import { NavigationContainer } from '@react-navigation/native';
import RNFS from 'react-native-fs';

const IntentLauncher = require('react-native-intent-launcher');

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
    checkManagePermission()
      .then((isManagePermitted) => {
        this.setState({ isManagePermitted });
      })
      .catch((error) => {
        console.error('Error checking storage permission:', error);
      });
    this.fetchData();
  }

  requestManageStoragePermission = async () => {
    try {
      const isManagePermitted = await requestManagePermission();
      this.setState({ isManagePermitted });
      if (isManagePermitted) {
        console.log('Storage permission granted.');
      } else {
        console.log('Storage permission denied.');
      }
    } catch (error) {
      console.error('Error requesting storage permission:', error);
    }
  };

  fetchData = async () => {
    this.setState({ isLoading: true });

    const githubUrl = 'https://raw.githubusercontent.com/MrPurple666/minecraft/main/mine.json';

    try {
      const response = await fetch(githubUrl);
      if (!response.ok) {
        throw new Error('Error in HTTP response');
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

      this.setState({ versions, isLoading: false });
    } catch (error) {
      console.error('Error fetching data from GitHub:', error);
    } finally {
      this.setState({ isLoading: false });
    }
  };

  downloadApk = async (link, nome) => {
    const apkLink = link;
    const nomeArquivo = nome || link.substring(link.lastIndexOf('/') + 1);
    const downloadDest = `<span class="math-inline">\{RNFS\.ExternalStorageDirectoryPath\}/mclauncher/</span>{nomeArquivo}.apk`;

    try {
      await RNFS.mkdir(`${RNFS.ExternalStorageDirectoryPath}/mclauncher`, {
        NSURLIsExcludedFromBackupKey: true,
      });

      this.setState({ downloading: true });

      const downloadResult = await RNFS.downloadFile({
        fromUrl: apkLink,
        toFile: downloadDest,
        progressDivider: 10,
      });

      if (downloadResult.statusCode === 200) {
        console.log('Download completed:', downloadDest);
        this.setState({
          downloadComplete: true,
          downloadSuccessMessage: 'Download completed. Open the mclauncher folder in your internal storage to install Minecraft.',
          showDeleteButton: true,
          downloadErrorMessage: '',
        });
      } else {
        console.log('Error downloading APK');
        this.setState({
          downloadErrorMessage: 'Error downloading APK. Please check your internet connection or try again later.',
          downloadSuccessMessage: '',
        });
      }
    } catch (error) {
      console.error('Error downloading APK:', error);
      this.setState({
        downloadErrorMessage: `Error downloading APK: ${error.message}`,
        downloadSuccessMessage: '',
      });
    } finally {
      this.setState({ downloading: false });
    }
  };

  openDownloadedApk = async () => {
    const filePath = `${RNFS.ExternalStorageDirectoryPath}/mclauncher/${this.state.downloadedFilePath}`;

    try {
      const exists = await RNFS.exists(filePath);

      if (exists) {
        console.log(`Opening downloaded APK: ${filePath}`);
        await IntentLauncher.startActivity({
          action: IntentLauncher.ACTION_VIEW,
          data: `file://${filePath}`,
          flags: IntentLauncher.FLAG_ACTIVITY_NEW_TASK, // Open in new task
          type: 'application/vnd.android.package-archive',
        });
      } else {
        console.log('Downloaded APK not found.');
        this.setState({ downloadErrorMessage: 'Downloaded APK not found.' });
      }
    } catch (error) {
      console.error('Error opening downloaded APK:', error);
      this.setState({ downloadErrorMessage: `Error opening downloaded APK: ${error.message}` });
    }
  };

  openLink = async (link, nome) => {
    const nomeArquivo = nome || link.substring(link.lastIndexOf('/') + 1);
    const filePath = `<span class="math-inline">\{RNFS\.ExternalStorageDirectoryPath\}/mclauncher/</span>{nomeArquivo}.apk`;

    try {
      const exists = await RNFS.exists(filePath);

      if (exists) {
        console.log(`APK found: ${filePath}`);
        this.setState({ downloadedFilePath: filePath });
        // Implement logic to open the downloaded APK (consider using IntentLauncher or linking libraries)
      } else {
        console.log(`APK not found: ${filePath}`);
        this.downloadApk(link, nome);
      }
    } catch (error) {
      console.error('Error checking for APK:', error);
      this.setState({
        downloadErrorMessage: `Error checking for downloaded APK: ${error.message}`,
      });
    }
  };

  deleteAllFiles = async () => {
    const mclauncherFolderPath = `${RNFS.ExternalStorageDirectoryPath}/mclauncher`;

    try {
      const files = await RNFS.readdir(mclauncherFolderPath);
      const deletePromises = files.map((file) => RNFS.unlink(file.path));
      await Promise.all(deletePromises);

      console.log('All files deleted.');
      this.setState({
        showDeleteButton: true,
        downloadCompleteMessage: '', // Clear download message
      });
    } catch (error) {
      console.error('Error deleting files:', error);
      this.setState({
        downloadErrorMessage: `Error deleting downloaded files: ${error.message}`,
      });
    }
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
            title="Storage Permission"
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
        return (
      <View style={styles.container}>
        {this.state.downloadedFilePath !== '' && (
          <Button
            title="Open Downloaded APK"
            onPress={this.openDownloadedApk}
            disabled={!this.state.downloadedFilePath}
          />
        )}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image source={require('./android/app/src/main/res/mipmap-xxxhdpi/title.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Minecraft Versions:</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Button
              title="Delete Files"
              onPress={this.deleteAllFiles}
              disabled={!this.state.showDeleteButton}
              color="red"
            />
            <Button
              title="Refresh"
              onPress={() => this.fetchData()}
              disabled={this.state.isLoading}
              color="#1a620b"
            />
          </View>
        </View>
        {this.state.isLoading ? (
          <ActivityIndicator size="large" color="white" />
        ) : (
          <NavigationContainer>
            <Tab.Navigator
              screenOptions={{
                tabBarLabelStyle: styles.tabBarLabel,
                tabBarStyle: styles.tabBar,
              }}
              initialRouteName="Stable"
            >
              <Tab.Screen name="Stable" component={() => (
                <FlatList
                  data={this.state.versions.filter((version) => version.tipo === 'stavel')}
                  renderItem={this.renderVersionItem}
                  keyExtractor={(item) => item.link}
                  ListHeaderComponent={() => (
                    <Text style={styles.versionListHeader}>Stable Versions</Text>
                  )}
                />
              )} />
              <Tab.Screen name="Beta" component={() => (
                <FlatList
                  data={this.state.versions.filter((version) => version.tipo === 'beta')}
                  renderItem={this.renderVersionItem}
                  keyExtractor={(item) => item.link}
                  ListHeaderComponent={() => (
                    <Text style={styles.versionListHeader}>Beta Versions</Text>
                  )}
                />
              )} />
              <Tab.Screen name="Legacy" component={() => (
                <FlatList
                  data={this.state.versions.filter((version) => version.tipo === 'legado')}
                  renderItem={this.renderVersionItem}
                  keyExtractor={(item) => item.link}
                  ListHeaderComponent={() => (
                    <Text style={styles.versionListHeader}>Legacy Versions</Text>
                  )}
                />
              )} />
              <Tab.Screen name="About" component={AboutScreen} />
            </Tab.Navigator>
            {this.state.downloading && (
              <View style={styles.downloadProgress}>
                <ProgressCircle
                  percent={this.state.downloadProgress}
                  radius={50}
                  borderWidth={8}
                  color="#1a620b"
                  shadowColor="#ddd"
                  bgcolor="#fff"
                />
                <Text style={styles.downloadProgressText}>Downloading...</Text>
              </View>
            )}
          </NavigationContainer>
          )}
        </View>
      );
    }
  }
  
  const AboutScreen = () => (
    <View style={styles.aboutContainer}>
      <Text style={styles.aboutText}>Minecraft Bedrock Downloader v1.0</Text>
      <Text style={styles.aboutText}>Contact: @MrPurple666 on Telegram</Text>
    </View>
  );
  
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
  });

  export default App;