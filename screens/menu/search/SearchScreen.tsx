import React from "react";
import { View, Text, StyleSheet } from "react-native";

const SearchScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buscador</Text>
    </View>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center", // centra verticalmente
    alignItems: "center", // centra horizontalmente
    backgroundColor: "#fff", // fondo blanco
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
});
