/**
 * México: estados y municipios (catálogo para selector — subset por estado).
 * Ampliar según necesidad operativa (INEGI catálogo completo ~2.5k municipios).
 */

const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

/** Nombre oficial del estado → municipios */
export const MX_MUNICIPALITIES: Record<string, string[]> = {
  Aguascalientes: split(
    'Aguascalientes,Asientos,Calvillo,Cosío,Jesús María,Pabellón de Arteaga,Rincón de Romos,San José de Gracia,Tepezalá,El Llano,San Francisco de los Romo',
  ),
  'Baja California': split(
    'Ensenada,Mexicali,Tecate,Tijuana,Playas de Rosarito,San Quintín,San Felipe,San Luis Río Colorado',
  ),
  'Baja California Sur': split(
    'Comondú,Mulegé,La Paz,Los Cabos,Loreto,Ciudad Constitución,Santa Rosalía,San José del Cabo,Cabo San Lucas',
  ),
  Campeche: split(
    'Campeche,Calkiní,Carmen,Champotón,Hecelchakán,Hopelchén,Palizada,Tenkabó,Escárcega,Candelaria,Calakmul',
  ),
  Coahuila: split(
    'Saltillo,Arteaga,Monclova,Piedras Negras,Ramos Arizpe,Sabinas,Torreón,Acuña,Francisco I. Madero,Múzquiz,Parras de la Fuente',
  ),
  Colima: split(
    'Colima,Armería,Comala,Coquimatlán,Cuauhtémoc,Ixtlahuacán,Manzanillo,Minatitlán,Tecomán,Villa de Álvarez',
  ),
  Chiapas: split(
    'Tuxtla Gutiérrez,San Cristóbal de las Casas,Tapachula,Palenque,Comitán de Domínguez,Ocosingo,Chiapa de Corzo,Villaflores,Cintalapa de Figueroa,Suchiapa,Berriozábal',
  ),
  Chihuahua: split(
    'Chihuahua,Juárez,Cuauhtémoc,Delicias,Parral,Nuevo Casas Grandes,Camargo,Jiménez,Guerrero,Bocoyna,Batopilas',
  ),
  Durango: split(
    'Durango,Gómez Palacio,Lerdo,Mapimí,El Oro,Nombre de Dios,Poanas,San Bernardo,San Dimas,San Juan del Río,Santiago Papasquiaro,Guadalupe Victoria',
  ),
  Guanajuato: split(
    'León,Irapuato,Celaya,Salamanca,San Miguel de Allende,Guanajuato,Silao,Pénjamo,Uriangato,Valle de Santiago,Apaseo el Grande',
  ),
  Guerrero: split(
    'Acapulco de Juárez,Chilpancingo de los Bravo,Iguala de la Independencia,Taxco de Alarcón,Zihuatanejo de Azueta,Tlapa de Comonfort,Tecpan de Galeana,Coyuca de Benítez,Petatlán,Arcelia,Teloloapan',
  ),
  Hidalgo: split(
    'Pachuca de Soto,Tulancingo de Bravo,Tula de Allende,Huejutla de Reyes,Mineral de la Reforma,Tizayuca,Actopan,Apan,Ixmiquilpan,Jacala de Ledezma,Zimapán',
  ),
  Jalisco: split(
    'Guadalajara,Zapopan,Tlaquepaque,Tonalá,Puerto Vallarta,Tlajomulco de Zúñiga,El Salto,Tepatitlán de Morelos,Lagos de Moreno,Ocotlán,Autlán de Navarro,La Barca',
  ),
  'Estado de México': split(
    'Toluca,Naucalpan de Juárez,Ecatepec de Morelos,Nezahualcóyotl,Tlalnepantla de Baz,Chimalhuacán,Cuautitlán Izcalli,Nicolás Romero,Tecámac,Texcoco,Ixtapaluca,Huixquilucan',
  ),
  Michoacán: split(
    'Morelia,Uruapan,Zamora,Lázaro Cárdenas,Apatzingán,Sahuayo,Pátzcuaro,Los Reyes de Salgado,La Piedad,Hidalgo,Jacona,Tangancícuaro',
  ),
  Morelos: split(
    'Cuernavaca,Cuautla,Jiutepec,Temixco,Emiliano Zapata,Xochitepec,Yautepec,Zacatepec,Tepoztlán,Tlayacapan,Huitzilac',
  ),
  Nayarit: split(
    'Tepic,Bahía de Banderas,Compostela,Santiago Ixcuintla,Xalisco,San Blas,Tuxpan,La Yesca,Rosamorada,Tecuala',
  ),
  'Nuevo León': split(
    'Monterrey,Guadalupe,San Nicolás de los Garza,Santa Catarina,San Pedro Garza García,Apodaca,Escobedo,García,Santiago,Salinas Victoria,Cadereyta Jiménez,Linares',
  ),
  Oaxaca: split(
    'Oaxaca de Juárez,Santa Cruz Xoxocotlán,Tuxtepec,Salina Cruz,Juchitán de Zaragoza,Huajuapan de León,San Juan Bautista Tuxtepec,Tlacolula de Matamoros,Miahuatlán de Porfirio Díaz,Pinotepa Nacional,Putla Villa de Guerrero',
  ),
  Puebla: split(
    'Puebla,San Andrés Cholula,San Pedro Cholula,Amozoc,Atlixco,Tehuacán,San Martín Texmelucan,Huauchinango,Teziutlán,Izúcar de Matamoros,Cuautlancingo,Cholula',
  ),
  Querétaro: split(
    'Querétaro,San Juan del Río,Corregidora,El Marqués,Huimilpan,Pedro Escobedo,Tequisquiapan,Amealco de Bonfil,Jalpan de Serra,Landa de Matamoros',
  ),
  'Quintana Roo': split(
    'Benito Juárez,Cozumel,Felipe Carrillo Puerto,Isla Mujeres,José María Morelos,Lázaro Cárdenas,Othón P. Blanco,Solidaridad,Tulum,Bacalar,Puerto Morelos',
  ),
  'San Luis Potosí': split(
    'San Luis Potosí,Soledad de Graciano Sánchez,Matehuala,Ciudad Valles,Rioverde,Cárdenas,Ciudad Fernández,Salinas,Santa María del Río,Tamazunchale,Ahualulco',
  ),
  Sinaloa: split(
    'Culiacán,Mazatlán,Ahome,Guasave,Angostura,Navolato,El Rosario,Escuinapa,El Fuerte,Choix,Concordia',
  ),
  Sonora: split(
    'Hermosillo,Cajeme,Nogales,San Luis Río Colorado,Guaymas,Navojoa,Agua Prieta,Etchojoa,Caborca,Puerto Peñasco,Empalme',
  ),
  Tabasco: split(
    'Centro,Cárdenas,Comalcalco,Cunduacán,Huimanguillo,Jalpa de Méndez,Jalapa,Macuspana,Nacajuca,Paraíso,Tenosique',
  ),
  Tamaulipas: split(
    'Reynosa,Matamoros,Nuevo Laredo,Tampico,Ciudad Madero,Altamira,El Mante,Río Bravo,San Fernando,Victoria,Xicoténcatl',
  ),
  Tlaxcala: split(
    'Tlaxcala,Apizaco,Chiautempan,Calpulalpan,Huamantla,Zacatelco,San Pablo del Monte,Tetla de la Solidaridad,Tlaxco,Yauhquemehcan',
  ),
  Veracruz: split(
    'Veracruz,Xalapa,Boca del Río,Córdoba,Orizaba,Poza Rica de Hidalgo,Coatzacoalcos,Minatitlán,Papantla,Tuxpan,Martínez de la Torre,Cosamaloapan',
  ),
  Yucatán: split(
    'Mérida,Kanasín,Valladolid,Tizimín,Progreso,Ticul,Umán,Tekax,Motul,Oxkutzcab,Tekit',
  ),
  Zacatecas: split(
    'Zacatecas,Guadalupe,Fresnillo,Jerez,Río Grande,Loreto,Calera,Villanueva,Nochistlán de Mejía,Pinos,Juan Aldama',
  ),
  'Ciudad de México': split(
    'Álvaro Obregón,Azcapotzalco,Benito Juárez,Coyoacán,Cuajimalpa de Morelos,Cuauhtémoc,Gustavo A. Madero,Iztacalco,Iztapalapa,La Magdalena Contreras,Miguel Hidalgo,Milpa Alta,Tláhuac,Tlalpan,Venustiano Carranza,Xochimilco',
  ),
}

export const MX_STATE_NAMES = Object.keys(MX_MUNICIPALITIES).sort((a, b) => a.localeCompare(b, 'es'))

export function listMexicoMunicipalities(stateName: string): string[] {
  return MX_MUNICIPALITIES[stateName] ?? []
}
